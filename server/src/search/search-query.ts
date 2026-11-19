import type { SqlQuery } from '../posts/feed-query';

export type SearchSort = 'RELEVANCE' | 'LATEST';

export interface SearchFilter {
  match: string;
  tagIds?: number[];
  sourceIds?: number[];
  since?: Date | null;
  sort: SearchSort;
  limit: number;
  offset: number;
}

export const TITLE_WEIGHT = 2;
export const TOTAL_CAP = 1000;
export const SEARCH_FILTER_INDEX = 'idx_posts_search_filter';

const MATCH_ALL = 'MATCH(s.title_tokens, s.body_tokens) AGAINST (? IN BOOLEAN MODE)';
const MATCH_TITLE = 'MATCH(s.title_tokens) AGAINST (? IN BOOLEAN MODE)';

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export function needsPostsJoin(filter: SearchFilter): boolean {
  return filter.sort === 'LATEST' || !!filter.since || !!filter.sourceIds?.length;
}

function fromClause(join: boolean): string {
  return join
    ? `FROM post_search s JOIN posts p FORCE INDEX (${SEARCH_FILTER_INDEX}) ON p.id = s.post_id`
    : 'FROM post_search s';
}

function whereClause(filter: SearchFilter, params: unknown[]): string {
  const where = [MATCH_ALL];
  params.push(filter.match);
  if (filter.since) {
    where.push('p.published_at >= ?');
    params.push(filter.since);
  }
  if (filter.sourceIds?.length) {
    where.push(`p.source_id IN (${placeholders(filter.sourceIds.length)})`);
    params.push(...filter.sourceIds);
  }
  if (filter.tagIds?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = s.post_id AND pt.tag_id IN (${placeholders(filter.tagIds.length)}))`,
    );
    params.push(...filter.tagIds);
  }
  return where.join(' AND ');
}

export function buildSearchQueries(filter: SearchFilter): { list: SqlQuery; count: SqlQuery } {
  const join = needsPostsJoin(filter);
  const from = fromClause(join);

  const listParams: unknown[] = [];
  let select = 'SELECT s.post_id AS id';
  let order: string;
  if (filter.sort === 'RELEVANCE') {
    select += `, (${MATCH_TITLE} * ${TITLE_WEIGHT} + ${MATCH_ALL}) AS score`;
    listParams.push(filter.match, filter.match);
    order = 'ORDER BY score DESC, s.post_id DESC';
  } else {
    order = 'ORDER BY p.published_at DESC, p.id DESC';
  }
  const listWhere = whereClause(filter, listParams);
  listParams.push(filter.limit, filter.offset);

  const countParams: unknown[] = [];
  const countWhere = whereClause(filter, countParams);
  return {
    list: { sql: `${select} ${from} WHERE ${listWhere} ${order} LIMIT ? OFFSET ?`, params: listParams },
    count: {
      sql: `SELECT COUNT(*) AS total FROM (SELECT 1 ${from} WHERE ${countWhere} LIMIT ?) capped`,
      params: [...countParams, TOTAL_CAP + 1],
    },
  };
}
