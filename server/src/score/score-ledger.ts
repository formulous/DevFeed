import type { EntityManager } from 'typeorm';
import { kstDayStart, SCORE } from './score-policy';

type Affected = { affectedRows: number };

async function todayCount(manager: EntityManager, userId: number, kind: 'READ' | 'COMMENT', now: Date): Promise<number> {
  const [{ n }] = (await manager.query(
    'SELECT COUNT(*) AS n FROM score_events WHERE user_id = ? AND kind = ? AND created_at >= ?',
    [userId, kind, kstDayStart(now)],
  )) as { n: number | string }[];
  return Number(n);
}

async function addScore(manager: EntityManager, userId: number, delta: number): Promise<void> {
  if (delta === 0) return;
  await manager.query(`UPDATE users SET score = score ${delta > 0 ? '+' : '-'} ? WHERE id = ?`, [Math.abs(delta), userId]);
}

export async function awardRead(manager: EntityManager, userId: number, postId: number, now: Date): Promise<void> {
  const [user] = (await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId])) as unknown[];
  if (!user) return;
  if ((await todayCount(manager, userId, 'READ', now)) >= SCORE.readDailyCap) return;
  const inserted = (await manager.query(
    "INSERT IGNORE INTO score_events (user_id, kind, ref_id, points, created_at) VALUES (?, 'READ', ?, ?, ?)",
    [userId, postId, SCORE.read, now],
  )) as Affected;
  if (inserted.affectedRows === 1) await addScore(manager, userId, SCORE.read);
}

export async function hasReadEvent(manager: EntityManager, userId: number, postId: number): Promise<boolean> {
  const rows = (await manager.query(
    "SELECT 1 FROM score_events WHERE user_id = ? AND kind = 'READ' AND ref_id = ?",
    [userId, postId],
  )) as unknown[];
  return rows.length > 0;
}

export async function setLikeEvent(
  manager: EntityManager,
  userId: number,
  postId: number,
  liked: boolean,
  now: Date,
): Promise<void> {
  const result = (await manager.query(
    liked
      ? "INSERT IGNORE INTO score_events (user_id, kind, ref_id, points, created_at) VALUES (?, 'LIKE', ?, ?, ?)"
      : "DELETE FROM score_events WHERE user_id = ? AND kind = 'LIKE' AND ref_id = ?",
    liked ? [userId, postId, SCORE.like, now] : [userId, postId],
  )) as Affected;
  if (result.affectedRows === 1) await addScore(manager, userId, liked ? SCORE.like : -SCORE.like);
}

export async function awardComment(manager: EntityManager, userId: number, commentId: number, now: Date): Promise<void> {
  const points = (await todayCount(manager, userId, 'COMMENT', now)) < SCORE.commentDailyCount ? SCORE.comment : 0;
  await manager.query(
    "INSERT INTO score_events (user_id, kind, ref_id, points, created_at) VALUES (?, 'COMMENT', ?, ?, ?)",
    [userId, commentId, points, now],
  );
  await addScore(manager, userId, points);
}

export async function setCommentRevoked(
  manager: EntityManager,
  authorId: number,
  commentId: number,
  revoked: boolean,
  now: Date,
): Promise<void> {
  const [event] = (await manager.query(
    "SELECT points FROM score_events WHERE user_id = ? AND kind = 'COMMENT' AND ref_id = ? FOR UPDATE",
    [authorId, commentId],
  )) as { points: number }[];
  if (!event) return;
  const changed = (await manager.query(
    revoked
      ? "UPDATE score_events SET revoked_at = ? WHERE user_id = ? AND kind = 'COMMENT' AND ref_id = ? AND revoked_at IS NULL"
      : "UPDATE score_events SET revoked_at = NULL WHERE user_id = ? AND kind = 'COMMENT' AND ref_id = ? AND revoked_at IS NOT NULL",
    revoked ? [now, authorId, commentId] : [authorId, commentId],
  )) as Affected;
  if (changed.affectedRows === 1) await addScore(manager, authorId, revoked ? -event.points : event.points);
}
