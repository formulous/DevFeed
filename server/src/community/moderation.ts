import type { EntityManager } from 'typeorm';
import { setCommentRevoked, setPostWriteRevoked } from '../score/score-ledger';

type Affected = { affectedRows: number };

export type HiddenReason = 'ADMIN' | 'REPORTS';
export type ReportTargetType = 'POST' | 'COMMENT';
export type ReportState = 'PENDING' | 'HIDDEN' | 'CLEARED';

export interface HideBy {
  reason: HiddenReason;
  adminId: number | null;
}

export async function hideComment(
  manager: EntityManager,
  comment: { id: number; postId: number; authorId: number },
  by: HideBy,
  now: Date,
): Promise<boolean> {
  const changed = (await manager.query(
    `UPDATE comments SET status = 'HIDDEN', hidden_at = ?, hidden_by = ?, hidden_reason = ?
      WHERE id = ? AND status = 'VISIBLE'`,
    [now, by.adminId, by.reason, comment.id],
  )) as Affected;
  if (changed.affectedRows !== 1) return false;
  await manager.query('UPDATE posts SET comment_count = comment_count - 1 WHERE id = ?', [comment.postId]);
  await manager.query('UPDATE community_posts SET accepted_comment_id = NULL WHERE post_id = ? AND accepted_comment_id = ?', [
    comment.postId,
    comment.id,
  ]);
  await setCommentRevoked(manager, comment.authorId, comment.id, true, now);
  return true;
}

export async function unhideComment(
  manager: EntityManager,
  comment: { id: number; postId: number; authorId: number },
  now: Date,
): Promise<boolean> {
  const changed = (await manager.query(
    `UPDATE comments SET status = 'VISIBLE', hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
      WHERE id = ? AND status = 'HIDDEN'`,
    [comment.id],
  )) as Affected;
  if (changed.affectedRows !== 1) return false;
  await manager.query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', [comment.postId]);
  await setCommentRevoked(manager, comment.authorId, comment.id, false, now);
  return true;
}

export async function hidePost(
  manager: EntityManager,
  post: { id: number; authorId: number },
  by: HideBy,
  now: Date,
): Promise<boolean> {
  const changed = (await manager.query(
    `UPDATE community_posts SET status = 'HIDDEN', hidden_at = ?, hidden_by = ?, hidden_reason = ?
      WHERE post_id = ? AND status = 'VISIBLE'`,
    [now, by.adminId, by.reason, post.id],
  )) as Affected;
  if (changed.affectedRows !== 1) return false;
  await setPostWriteRevoked(manager, post.authorId, post.id, true, now);
  return true;
}

export async function unhidePost(manager: EntityManager, post: { id: number; authorId: number }, now: Date): Promise<boolean> {
  const changed = (await manager.query(
    `UPDATE community_posts SET status = 'VISIBLE', hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
      WHERE post_id = ? AND status = 'HIDDEN'`,
    [post.id],
  )) as Affected;
  if (changed.affectedRows !== 1) return false;
  await setPostWriteRevoked(manager, post.authorId, post.id, false, now);
  return true;
}

export async function resolveReportTarget(
  manager: EntityManager,
  type: ReportTargetType,
  id: number,
  state: 'HIDDEN' | 'CLEARED',
  adminId: number,
  now: Date,
): Promise<void> {
  await manager.query(
    'UPDATE report_targets SET state = ?, resolved_at = ?, resolved_by = ? WHERE target_type = ? AND target_id = ?',
    [state, now, adminId, type, id],
  );
}

export async function dropCommentReports(manager: EntityManager, commentIds: number[]): Promise<void> {
  if (!commentIds.length) return;
  await manager.query(
    `DELETE FROM report_targets WHERE target_type = 'COMMENT' AND target_id IN (${commentIds.map(() => '?').join(', ')})`,
    commentIds,
  );
}
