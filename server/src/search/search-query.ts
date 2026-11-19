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

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function whereClause(filter: SearchFilter, params: unknown[]): string {
  const where = ['MATCH(s.title_tokens, s.body_tokens) AGAINST (? IN BOOLEAN MODE)'];
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
      `EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag_id IN (${placeholders(filter.tagIds.length)}))`,
    );
    params.push(...filter.tagIds);
  }
  return where.join(' AND ');
}

export function buildSearchQueries(filter: SearchFilter): { list: SqlQuery; count: SqlQuery } {
  const listParams: unknown[] = [];
  let select = 'SELECT p.id AS id';
  let order = 'ORDER BY p.published_at DESC, p.id DESC';
  if (filter.sort === 'RELEVANCE') {
    select += `, (MATCH(s.title_tokens) AGAINST (? IN BOOLEAN MODE) * ${TITLE_WEIGHT} + MATCH(s.title_tokens, s.body_tokens) AGAINST (? IN BOOLEAN MODE)) AS score`;
    listParams.push(filter.match, filter.match);
    order = 'ORDER BY score DESC, p.published_at DESC, p.id DESC';
  }
  const listWhere = whereClause(filter, listParams);
  listParams.push(filter.limit, filter.offset);

  const countParams: unknown[] = [];
  const countWhere = whereClause(filter, countParams);
  const from = 'FROM post_search s JOIN posts p ON p.id = s.post_id';
  return {
    list: { sql: `${select} ${from} WHERE ${listWhere} ${order} LIMIT ? OFFSET ?`, params: listParams },
    count: { sql: `SELECT COUNT(*) AS total ${from} WHERE ${countWhere}`, params: countParams },
  };
}
