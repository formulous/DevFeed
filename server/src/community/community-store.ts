import type { EntityManager } from 'typeorm';

export async function softDeletePost(manager: EntityManager, postId: number): Promise<void> {
  await manager.query(
    `UPDATE community_posts SET status = 'DELETED', body = NULL, user_id = NULL, accepted_comment_id = NULL,
            hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
      WHERE post_id = ?`,
    [postId],
  );
  await manager.query("UPDATE posts SET title = '', summary = NULL WHERE id = ?", [postId]);
  await manager.query('DELETE FROM post_tags WHERE post_id = ?', [postId]);
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
