import type { TimeIdCursor } from '../common/pagination/cursor';
import type { SourceKind } from '../entities/source.entity';

export interface FeedFilter {
  kind?: SourceKind;
  tagIds?: number[];
  fieldTagIds?: number[];
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

function fieldClause(postColumn: string, fieldTagIds: number[] | undefined, params: unknown[]): string[] {
  if (!fieldTagIds?.length) return [];
  params.push(...fieldTagIds);
  return [`EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = ${postColumn} AND fx.tag_id IN (${placeholders(fieldTagIds.length)}))`];
}

function tagSubquery(tagId: number, filter: FeedFilter, fieldTagIds: number[] | undefined, params: unknown[]): string {
  const needsJoin = !!filter.sourceIds?.length || !!filter.sourceType;
  const where = ['pt.tag_id = ?', 'pt.kind = ?'];
  params.push(tagId, filter.kind ?? 'BLOG');
  where.push(...cursorClause('pt.published_at', 'pt.post_id', filter.cursor, params));
  if (filter.sourceIds?.length) {
    where.push(`p.source_id IN (${placeholders(filter.sourceIds.length)})`);
    params.push(...filter.sourceIds);
  }
  if (filter.sourceType) {
    where.push('p.source_type = ?');
    params.push(filter.sourceType);
  }
  where.push(...fieldClause('pt.post_id', fieldTagIds, params));
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
  } else {
    where.push('p.kind = ?');
    params.push(filter.kind ?? 'BLOG');
  }
  if (filter.sourceType) {
    where.push('p.source_type = ?');
    params.push(filter.sourceType);
  }
  where.push(...cursorClause('p.published_at', 'p.id', filter.cursor, params));
  where.push(...fieldClause('p.id', filter.fieldTagIds, params));
  params.push(filter.limit);
  return `(SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE ${where.join(
    ' AND ',
  )} ORDER BY p.published_at DESC, p.id DESC LIMIT ?)`;
}

function merged(parts: string[], operator: 'UNION' | 'UNION ALL', filter: FeedFilter, params: unknown[]): SqlQuery {
  if (parts.length === 1) return { sql: parts[0].slice(1, -1), params };
  params.push(filter.limit);
  return {
    sql: `SELECT id, published_at FROM (${parts.join(` ${operator} `)}) f ORDER BY published_at DESC, id DESC LIMIT ?`,
    params,
  };
}

export function buildFeedQuery(filter: FeedFilter): SqlQuery {
  const params: unknown[] = [];
  const tagIds = filter.tagIds ?? [];
  const sourceIds = filter.sourceIds ?? [];
  const fieldTagIds = filter.fieldTagIds ?? [];

  if (tagIds.length) {
    const parts = tagIds.map((tagId) => tagSubquery(tagId, filter, fieldTagIds, params));
    return merged(parts, 'UNION', filter, params);
  }
  if (sourceIds.length) {
    const parts =
      sourceIds.length > 1
        ? sourceIds.map((sourceId) => postsSubquery(filter, [sourceId], params))
        : [postsSubquery(filter, sourceIds, params)];
    return merged(parts, 'UNION ALL', filter, params);
  }
  if (fieldTagIds.length) {
    const parts = fieldTagIds.map((tagId) => tagSubquery(tagId, filter, undefined, params));
    return merged(parts, 'UNION', filter, params);
  }
  return merged([postsSubquery(filter, null, params)], 'UNION ALL', filter, params);
}
