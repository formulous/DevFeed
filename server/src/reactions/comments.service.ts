import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { withDeadlockRetry } from '../common/database/deadlock-retry';
import { AppException, Errors } from '../common/errors/app.exception';
import { decodeIdCursor, encodeIdCursor } from '../common/pagination/cursor';
import { awardComment, setCommentRevoked } from '../score/score-ledger';
import { commentRetryAfterSec, COMMENT_RATE } from './comment-rate';
import { CommentRow, CommentView, toCommentView, Viewer } from './comment-view';

const DEFAULT_SIZE = 20;
const REPLY_PREVIEW = 3;
const COLUMNS = `c.id, c.post_id, c.parent_id, c.user_id, c.body, c.status, c.reply_count, c.edited_at, c.created_at, u.nickname, u.score`;

type Affected = { affectedRows: number };
type LockedComment = { id: number | string; post_id: number | string; parent_id: number | string | null; user_id: number | string | null; status: CommentRow['status'] };

const commentNotFound = () => Errors.notFound('댓글을 찾을 수 없어요');
const postNotFound = () => Errors.notFound('글을 찾을 수 없어요');
const notMine = () => new AppException(403, 'FORBIDDEN', '내 댓글만 수정하거나 삭제할 수 있어요');

@Injectable()
export class CommentsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(postId: number, query: { cursor?: string; size?: number }, viewer?: Viewer) {
    const size = query.size ?? DEFAULT_SIZE;
    const after = query.cursor ? decodeIdCursor(query.cursor) : 0;
    const [post] = (await this.dataSource.query('SELECT id FROM posts WHERE id = ?', [postId])) as unknown[];
    if (!post) throw postNotFound();
    const rows = (await this.dataSource.query(
      `SELECT ${COLUMNS} FROM comments c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ? AND c.parent_id IS NULL AND c.id > ? ORDER BY c.id LIMIT ?`,
      [postId, after, size + 1],
    )) as CommentRow[];
    const page = rows.slice(0, size);
    const parents = page.filter((r) => Number(r.reply_count) > 0).map((r) => Number(r.id));
    const replies = parents.length
      ? ((await this.dataSource.query(
          `SELECT ${COLUMNS} FROM (
             SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.parent_id ORDER BY x.id) AS rn
               FROM comments x WHERE x.parent_id IN (${parents.map(() => '?').join(', ')})
           ) c LEFT JOIN users u ON u.id = c.user_id
           WHERE c.rn <= ? ORDER BY c.parent_id, c.id`,
          [...parents, REPLY_PREVIEW + 1],
        )) as CommentRow[])
      : [];
    const byParent = new Map<number, CommentRow[]>();
    for (const reply of replies) {
      const key = Number(reply.parent_id);
      byParent.set(key, [...(byParent.get(key) ?? []), reply]);
    }
    const last = page[page.length - 1];
    return {
      items: page.map((row) => {
        const children = byParent.get(Number(row.id)) ?? [];
        const shown = children.slice(0, REPLY_PREVIEW);
        return {
          ...toCommentView(row, viewer),
          replies: shown.map((r) => toCommentView(r, viewer)),
          repliesNextCursor: children.length > REPLY_PREVIEW ? encodeIdCursor(Number(shown[shown.length - 1].id)) : null,
        };
      }),
      nextCursor: rows.length > size && last ? encodeIdCursor(Number(last.id)) : null,
    };
  }

  async replies(commentId: number, query: { cursor?: string; size?: number }, viewer?: Viewer) {
    const size = query.size ?? DEFAULT_SIZE;
    const after = query.cursor ? decodeIdCursor(query.cursor) : 0;
    const [parent] = (await this.dataSource.query('SELECT id FROM comments WHERE id = ? AND parent_id IS NULL', [
      commentId,
    ])) as unknown[];
    if (!parent) throw commentNotFound();
    const rows = (await this.dataSource.query(
      `SELECT ${COLUMNS} FROM comments c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.parent_id = ? AND c.id > ? ORDER BY c.id LIMIT ?`,
      [commentId, after, size + 1],
    )) as CommentRow[];
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => toCommentView(r, viewer)),
      nextCursor: rows.length > size && last ? encodeIdCursor(Number(last.id)) : null,
    };
  }

  create(viewer: Viewer, postId: number, content: string, parentId?: number, now = new Date()) {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [viewer.id]);
        await this.checkRate(manager, viewer.id);
        const [post] = (await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId])) as unknown[];
        if (!post) throw postNotFound();
        let parent: number | null = null;
        if (parentId !== undefined) {
          const found = await this.find(manager, parentId);
          const topId = found?.parent_id != null ? Number(found.parent_id) : parentId;
          const target = found ? await this.lock(manager, topId) : undefined;
          if (!target || target.parent_id !== null || Number(target.post_id) !== postId || target.status === 'DELETED') throw commentNotFound();
          parent = Number(target.id);
        }
        const inserted = (await manager.query('INSERT INTO comments (post_id, parent_id, user_id, body) VALUES (?, ?, ?, ?)', [
          postId,
          parent,
          viewer.id,
          content,
        ])) as { insertId: number };
        if (parent !== null) await manager.query('UPDATE comments SET reply_count = reply_count + 1 WHERE id = ?', [parent]);
        await manager.query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', [postId]);
        await awardComment(manager, viewer.id, Number(inserted.insertId), now);
        return { comment: await this.view(manager, Number(inserted.insertId), viewer), commentCount: await this.count(manager, postId) };
      }),
    );
  }

  update(viewer: Viewer, commentId: number, content: string) {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const target = await this.lock(manager, commentId);
        if (!target || target.status === 'DELETED') throw commentNotFound();
        if (Number(target.user_id) !== viewer.id) throw notMine();
        if (target.status === 'HIDDEN') throw Errors.commentHidden();
        await manager.query('UPDATE comments SET body = ?, edited_at = UTC_TIMESTAMP(3) WHERE id = ?', [content, commentId]);
        return this.view(manager, commentId, viewer);
      }),
    );
  }

  remove(viewer: Viewer, commentId: number, now = new Date()) {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const found = await this.find(manager, commentId);
        if (!found || found.status === 'DELETED') throw commentNotFound();
        if (Number(found.user_id) !== viewer.id) throw notMine();
        const postId = Number(found.post_id);
        await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [viewer.id]);
        await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId]);
        if (found.parent_id !== null) await this.lock(manager, Number(found.parent_id));
        const target = await this.lock(manager, commentId);
        if (!target || target.status === 'DELETED' || Number(target.user_id) !== viewer.id) throw commentNotFound();
        let removed = true;
        let parentRemoved = false;
        if (target.parent_id === null) {
          const placeholder = (await manager.query(
            `UPDATE comments SET status = 'DELETED', body = NULL, user_id = NULL, hidden_at = NULL, hidden_by = NULL
              WHERE id = ? AND reply_count > 0`,
            [commentId],
          )) as Affected;
          if (placeholder.affectedRows === 1) removed = false;
          else await manager.query('DELETE FROM comments WHERE id = ?', [commentId]);
        } else {
          const parentId = Number(target.parent_id);
          await manager.query('DELETE FROM comments WHERE id = ?', [commentId]);
          await manager.query('UPDATE comments SET reply_count = reply_count - 1 WHERE id = ?', [parentId]);
          const dropped = (await manager.query(
            "DELETE FROM comments WHERE id = ? AND status = 'DELETED' AND reply_count = 0",
            [parentId],
          )) as Affected;
          parentRemoved = dropped.affectedRows === 1;
        }
        if (target.status === 'VISIBLE') {
          await manager.query('UPDATE posts SET comment_count = comment_count - 1 WHERE id = ?', [postId]);
        }
        await setCommentRevoked(manager, viewer.id, commentId, true, now);
        return { commentCount: await this.count(manager, postId), removed, parentRemoved };
      }),
    );
  }

  setHidden(admin: Viewer, commentId: number, hidden: boolean, now = new Date()) {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const found = await this.find(manager, commentId);
        if (!found || found.status === 'DELETED' || found.user_id === null) throw commentNotFound();
        const postId = Number(found.post_id);
        const authorId = Number(found.user_id);
        await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [authorId]);
        await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId]);
        const target = await this.lock(manager, commentId);
        if (!target || target.status === 'DELETED' || Number(target.user_id) !== authorId) throw commentNotFound();
        const changed = (await manager.query(
          hidden
            ? "UPDATE comments SET status = 'HIDDEN', hidden_at = UTC_TIMESTAMP(3), hidden_by = ? WHERE id = ? AND status = 'VISIBLE'"
            : "UPDATE comments SET status = 'VISIBLE', hidden_at = NULL, hidden_by = NULL WHERE id = ? AND status = 'HIDDEN'",
          hidden ? [admin.id, commentId] : [commentId],
        )) as Affected;
        if (changed.affectedRows === 1) {
          await manager.query(`UPDATE posts SET comment_count = comment_count ${hidden ? '-' : '+'} 1 WHERE id = ?`, [postId]);
          await setCommentRevoked(manager, authorId, commentId, hidden, now);
        }
        return { comment: await this.view(manager, commentId, admin), commentCount: await this.count(manager, postId) };
      }),
    );
  }

  private async checkRate(manager: EntityManager, userId: number): Promise<void> {
    const rows = (await manager.query(
      `SELECT created_at, UTC_TIMESTAMP(3) AS now FROM comments
        WHERE user_id = ? AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 DAY
        ORDER BY created_at DESC LIMIT ?`,
      [userId, COMMENT_RATE.perDay],
    )) as { created_at: Date; now: Date }[];
    if (!rows.length) return;
    const retry = commentRetryAfterSec(rows.map((r) => r.created_at), rows[0].now);
    if (retry !== null) throw Errors.commentRateLimited(retry);
  }

  private async find(manager: EntityManager, id: number): Promise<LockedComment | undefined> {
    const [row] = (await manager.query('SELECT id, post_id, parent_id, user_id, status FROM comments WHERE id = ?', [
      id,
    ])) as LockedComment[];
    return row;
  }

  private async lock(manager: EntityManager, id: number): Promise<LockedComment | undefined> {
    const [row] = (await manager.query(
      'SELECT id, post_id, parent_id, user_id, status FROM comments WHERE id = ? FOR UPDATE',
      [id],
    )) as LockedComment[];
    return row;
  }

  private async view(manager: EntityManager, id: number, viewer: Viewer): Promise<CommentView> {
    const [row] = (await manager.query(
      `SELECT ${COLUMNS} FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
      [id],
    )) as CommentRow[];
    return toCommentView(row, viewer);
  }

  private async count(manager: EntityManager, postId: number): Promise<number> {
    const [{ comment_count }] = (await manager.query('SELECT comment_count FROM posts WHERE id = ?', [postId])) as {
      comment_count: number;
    }[];
    return Number(comment_count);
  }
}
