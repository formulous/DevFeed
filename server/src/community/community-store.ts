import type { EntityManager } from 'typeorm';
import { toTokenString } from '../ingest/tokenizer';
import { markdownExcerpt } from './markdown-excerpt';

export const SEARCH_BODY_MAX = 2000;

export async function indexCommunityPost(manager: EntityManager, postId: number): Promise<void> {
  const [row] = (await manager.query(
    "SELECT p.title, cp.body FROM posts p JOIN community_posts cp ON cp.post_id = p.id WHERE p.id = ? AND cp.status <> 'DELETED'",
    [postId],
  )) as { title: string; body: string | null }[];
  if (!row) {
    await manager.query('DELETE FROM community_search WHERE post_id = ?', [postId]);
    return;
  }
  const terms = (await manager.query(
    `SELECT t.name, s.synonym FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
       LEFT JOIN tag_synonyms s ON s.tag_id = t.id WHERE pt.post_id = ? ORDER BY pt.tag_rank`,
    [postId],
  )) as { name: string; synonym: string | null }[];
  const tagText = [...new Set(terms.flatMap((t) => (t.synonym ? [t.name, t.synonym] : [t.name])))].join(' ');
  await manager.query(
    `INSERT INTO community_search (post_id, title_tokens, body_tokens) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE title_tokens = VALUES(title_tokens), body_tokens = VALUES(body_tokens)`,
    [postId, toTokenString(row.title), toTokenString(markdownExcerpt(row.body ?? '', SEARCH_BODY_MAX), tagText)],
  );
}

export async function softDeletePost(manager: EntityManager, postId: number): Promise<void> {
  await manager.query(
    `UPDATE community_posts SET status = 'DELETED', body = NULL, user_id = NULL, accepted_comment_id = NULL,
            hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
      WHERE post_id = ?`,
    [postId],
  );
  await manager.query("UPDATE posts SET title = '', summary = NULL WHERE id = ?", [postId]);
  await manager.query('DELETE FROM post_tags WHERE post_id = ?', [postId]);
  await manager.query('DELETE FROM community_search WHERE post_id = ?', [postId]);
}

export async function replaceTags(manager: EntityManager, postId: number, publishedAt: Date, tagIds: number[]): Promise<void> {
  await manager.query('DELETE FROM post_tags WHERE post_id = ?', [postId]);
  for (const [i, tagId] of tagIds.entries()) {
    await manager.query("INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at, kind) VALUES (?, ?, ?, ?, 'COMMUNITY')", [
      postId,
      tagId,
      i + 1,
      publishedAt,
    ]);
  }
}
