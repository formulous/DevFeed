import type { TimeIdCursor } from '../common/pagination/cursor';
import type { SqlQuery } from '../posts/feed-query';

export const BOOKMARK_LIMIT = 5000;

export const LISTABLE = (alias: string) =>
  `NOT EXISTS (SELECT 1 FROM community_posts cx WHERE cx.post_id = ${alias}.post_id AND cx.status <> 'VISIBLE')`;

export function bookmarkListQuery(userId: number, limit: number, cursor?: TimeIdCursor, tagIds?: number[]): SqlQuery {
  const where = ['b.user_id = ?', LISTABLE('b')];
  const params: unknown[] = [userId];
  if (cursor) {
    where.push('(b.created_at < ? OR (b.created_at = ? AND b.post_id < ?))');
    params.push(cursor.at, cursor.at, cursor.id);
  }
  if (tagIds?.length) {
    where.push(`EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = b.post_id AND pt.tag_id IN (${tagIds.map(() => '?').join(', ')}))`);
    params.push(...tagIds);
  }
  params.push(limit);
  return {
    sql: `SELECT b.post_id AS id, b.created_at AS at FROM bookmarks b WHERE ${where.join(' AND ')} ORDER BY b.created_at DESC, b.post_id DESC LIMIT ?`,
    params,
  };
}

export function historyListQuery(userId: number, limit: number, cursor?: TimeIdCursor): SqlQuery {
  const where = ['h.user_id = ?', LISTABLE('h')];
  const params: unknown[] = [userId];
  if (cursor) {
    where.push('(h.last_read_at < ? OR (h.last_read_at = ? AND h.post_id < ?))');
    params.push(cursor.at, cursor.at, cursor.id);
  }
  params.push(limit);
  return {
    sql: `SELECT h.post_id AS id, h.last_read_at AS at FROM read_histories h WHERE ${where.join(' AND ')} ORDER BY h.last_read_at DESC, h.post_id DESC LIMIT ?`,
    params,
  };
}
