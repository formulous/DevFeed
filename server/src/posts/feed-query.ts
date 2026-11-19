import type { TimeIdCursor } from '../common/pagination/cursor';

export interface FeedFilter {
  tagIds?: number[];
  sourceIds?: number[];
  sourceType?: 'COMPANY' | 'PERSONAL';
  cursor?: TimeIdCursor;
  limit: number;
}

export interface SqlQuery {
  sql: string;
  params: unknown[];
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function cursorClause(column: string, idColumn: string, cursor: TimeIdCursor | undefined, params: unknown[]): string[] {
  if (!cursor) return [];
  params.push(cursor.at, cursor.at, cursor.id);
  return [`(${column} < ? OR (${column} = ? AND ${idColumn} < ?))`];
}

function tagSubquery(tagId: number, filter: FeedFilter, params: unknown[]): string {
  const needsJoin = !!filter.sourceIds?.length || !!filter.sourceType;
  const where = ['pt.tag_id = ?'];
  params.push(tagId);
  where.push(...cursorClause('pt.published_at', 'pt.post_id', filter.cursor, params));
  if (filter.sourceIds?.length) {
    where.push(`p.source_id IN (${placeholders(filter.sourceIds.length)})`);
    params.push(...filter.sourceIds);
  }
  if (filter.sourceType) {
    where.push('p.source_type = ?');
    params.push(filter.sourceType);
  }
  params.push(filter.limit);
  return `(SELECT pt.post_id AS id, pt.published_at AS published_at FROM post_tags pt${
    needsJoin ? ' JOIN posts p ON p.id = pt.post_id' : ''
  } WHERE ${where.join(' AND ')} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT ?)`;
}

function postsSubquery(filter: FeedFilter, sourceIds: number[] | null, params: unknown[]): string {
  const where: string[] = [];
  if (sourceIds) {
    where.push(sourceIds.length === 1 ? 'p.source_id = ?' : `p.source_id IN (${placeholders(sourceIds.length)})`);
    params.push(...sourceIds);
  }
  if (filter.sourceType) {
    where.push('p.source_type = ?');
    params.push(filter.sourceType);
  }
  where.push(...cursorClause('p.published_at', 'p.id', filter.cursor, params));
  params.push(filter.limit);
  return `(SELECT p.id AS id, p.published_at AS published_at FROM posts p${
    where.length ? ` WHERE ${where.join(' AND ')}` : ''
  } ORDER BY p.published_at DESC, p.id DESC LIMIT ?)`;
}

export function buildFeedQuery(filter: FeedFilter): SqlQuery {
  const params: unknown[] = [];
  const tagIds = filter.tagIds ?? [];
  const sourceIds = filter.sourceIds ?? [];

  if (tagIds.length === 1) {
    const sql = tagSubquery(tagIds[0], filter, params);
    return { sql: sql.slice(1, -1), params };
  }
  if (tagIds.length > 1) {
    const parts = tagIds.map((tagId) => tagSubquery(tagId, filter, params));
    params.push(filter.limit);
    return {
      sql: `SELECT id, published_at FROM (${parts.join(' UNION ')}) f ORDER BY published_at DESC, id DESC LIMIT ?`,
      params,
    };
  }
  if (sourceIds.length > 1) {
    const parts = sourceIds.map((sourceId) => postsSubquery(filter, [sourceId], params));
    params.push(filter.limit);
    return {
      sql: `SELECT id, published_at FROM (${parts.join(' UNION ALL ')}) f ORDER BY published_at DESC, id DESC LIMIT ?`,
      params,
    };
  }
  const sql = postsSubquery(filter, sourceIds.length === 1 ? sourceIds : null, params);
  return { sql: sql.slice(1, -1), params };
}
