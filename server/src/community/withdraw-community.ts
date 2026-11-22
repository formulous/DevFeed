import type { EntityManager } from 'typeorm';
import { softDeletePost } from './community-store';

export async function removeCommunity(manager: EntityManager, userId: number): Promise<void> {
  const received = (await manager.query(
    `SELECT e.user_id, SUM(e.points) AS total FROM post_likes l
       JOIN community_posts cp ON cp.post_id = l.post_id
       JOIN score_events e ON e.user_id = cp.user_id AND e.kind = 'LIKE_RECEIVED' AND e.ref_id = l.post_id AND e.actor_id = l.user_id
      WHERE l.user_id = ? GROUP BY e.user_id`,
    [userId],
  )) as { user_id: number | string; total: number | string }[];
  for (const { user_id, total } of received) {
    await manager.query('UPDATE users SET score = score - ? WHERE id = ?', [Number(total), user_id]);
    await manager.query("DELETE FROM score_events WHERE user_id = ? AND kind = 'LIKE_RECEIVED' AND actor_id = ?", [user_id, userId]);
  }
  await manager.query(
    `UPDATE community_posts cp JOIN comments c ON c.id = cp.accepted_comment_id
        SET cp.accepted_comment_id = NULL WHERE c.user_id = ?`,
    [userId],
  );
  const posts = (await manager.query('SELECT post_id FROM community_posts WHERE user_id = ?', [userId])) as {
    post_id: number | string;
  }[];
  for (const { post_id } of posts) await softDeletePost(manager, Number(post_id));
}

export async function dropOrphanCommentReports(manager: EntityManager): Promise<void> {
  await manager.query(
    `DELETE rt FROM report_targets rt LEFT JOIN comments c ON c.id = rt.target_id
      WHERE rt.target_type = 'COMMENT' AND c.id IS NULL`,
  );
}
