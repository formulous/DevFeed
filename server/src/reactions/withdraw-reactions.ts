import type { EntityManager } from 'typeorm';

export async function removeReactions(manager: EntityManager, userId: number): Promise<void> {
  await manager.query(
    'UPDATE posts p JOIN post_likes l ON l.post_id = p.id SET p.like_count = p.like_count - 1 WHERE l.user_id = ?',
    [userId],
  );
  await manager.query('DELETE FROM post_likes WHERE user_id = ?', [userId]);
  await manager.query(
    `UPDATE posts p JOIN (SELECT post_id, COUNT(*) AS n FROM comments WHERE user_id = ? AND status = 'VISIBLE' GROUP BY post_id) c
        ON c.post_id = p.id
        SET p.comment_count = p.comment_count - c.n`,
    [userId],
  );
  const parents = (await manager.query(
    'SELECT parent_id, COUNT(*) AS n FROM comments WHERE user_id = ? AND parent_id IS NOT NULL GROUP BY parent_id',
    [userId],
  )) as { parent_id: number | string; n: number | string }[];
  for (const { parent_id, n } of parents) {
    await manager.query('UPDATE comments SET reply_count = reply_count - ? WHERE id = ?', [Number(n), parent_id]);
  }
  await manager.query('DELETE FROM comments WHERE user_id = ? AND parent_id IS NOT NULL', [userId]);
  await manager.query(
    `UPDATE comments SET status = 'DELETED', body = NULL, user_id = NULL, hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
      WHERE user_id = ? AND reply_count > 0`,
    [userId],
  );
  await manager.query('DELETE FROM comments WHERE user_id = ? AND reply_count = 0', [userId]);
  if (parents.length) {
    await manager.query(
      `DELETE FROM comments WHERE id IN (${parents.map(() => '?').join(', ')}) AND status = 'DELETED' AND reply_count = 0`,
      parents.map((p) => p.parent_id),
    );
  }
}
