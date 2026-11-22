import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { withDeadlockRetry } from '../common/database/deadlock-retry';
import { Errors } from '../common/errors/app.exception';
import type { Viewer } from '../reactions/comment-view';
import { CreateReportDto, REPORT_REASONS, ReportReason } from './dto/community.dto';
import { hideComment, hidePost, HiddenReason, ReportState, ReportTargetType, unhideComment, unhidePost } from './moderation';
import { decodeReportCursor, encodeReportCursor } from './report-cursor';

export const AUTO_HIDE_REPORTS = 3;
const DEFAULT_SIZE = 20;
const PREVIEW_MAX = 200;
const DETAILS_MAX = 5;

type Status = 'VISIBLE' | 'HIDDEN' | 'DELETED';

interface Target {
  type: ReportTargetType;
  id: number;
  postId: number;
  authorId: number;
  status: Status;
  isCommunityPost: boolean;
}

interface TargetRow {
  target_type: ReportTargetType;
  target_id: number | string;
  report_count: number | string;
  state: ReportState;
  last_reported_at: Date;
  c_post_id: number | string | null;
  c_body: string | null;
  c_status: Status | null;
  c_reason: HiddenReason | null;
  c_author_id: number | string | null;
  c_author_nickname: string | null;
  p_status: Status | null;
  p_reason: HiddenReason | null;
  p_title: string | null;
  p_summary: string | null;
  p_author_id: number | string | null;
  p_author_nickname: string | null;
}

const TARGET_SQL = `SELECT rt.target_type, rt.target_id, rt.report_count, rt.state, rt.last_reported_at,
       c.post_id AS c_post_id, c.body AS c_body, c.status AS c_status, c.hidden_reason AS c_reason,
       cu.id AS c_author_id, cu.nickname AS c_author_nickname,
       cp.status AS p_status, cp.hidden_reason AS p_reason, p.title AS p_title, p.summary AS p_summary,
       pu.id AS p_author_id, pu.nickname AS p_author_nickname
  FROM report_targets rt
  LEFT JOIN comments c ON rt.target_type = 'COMMENT' AND c.id = rt.target_id
  LEFT JOIN users cu ON cu.id = c.user_id
  LEFT JOIN community_posts cp ON rt.target_type = 'POST' AND cp.post_id = rt.target_id
  LEFT JOIN posts p ON p.id = cp.post_id
  LEFT JOIN users pu ON pu.id = cp.user_id`;

const LIVE = "((c.id IS NOT NULL AND c.status <> 'DELETED') OR cp.status IN ('VISIBLE', 'HIDDEN'))";

const clip = (text: string | null) => {
  const chars = [...(text ?? '')];
  return chars.length <= PREVIEW_MAX ? chars.join('') : `${chars.slice(0, PREVIEW_MAX - 1).join('')}…`;
};

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  report(user: Viewer, dto: CreateReportDto, now = new Date()) {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const found = await this.findTarget(manager, dto.targetType, dto.targetId);
        if (!found || found.status === 'DELETED') throw Errors.notFound('신고할 대상을 찾을 수 없어요');
        if (found.authorId === user.id) throw Errors.reportOwnContent();
        if (found.type === 'POST' && found.status === 'HIDDEN' && user.role !== 'ADMIN') {
          throw Errors.notFound('신고할 대상을 찾을 수 없어요');
        }
        const target = await this.lockTarget(manager, found);
        await manager.query(
          `INSERT INTO report_targets (target_type, target_id, first_reported_at, last_reported_at) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE target_id = target_id`,
          [target.type, target.id, now, now],
        );
        const [summary] = (await manager.query(
          'SELECT report_count, state FROM report_targets WHERE target_type = ? AND target_id = ? FOR UPDATE',
          [target.type, target.id],
        )) as { report_count: number | string; state: ReportState }[];
        const inserted = (await manager.query(
          `INSERT IGNORE INTO reports (target_type, target_id, reporter_id, reason, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [target.type, target.id, user.id, dto.reason, dto.reason === 'OTHER' ? (dto.detail ?? null) : null, now],
        )) as { affectedRows: number };
        if (inserted.affectedRows !== 1) throw Errors.reportDuplicated();
        const count = Number(summary.report_count) + 1;
        const autoHide = summary.state === 'PENDING' && count >= AUTO_HIDE_REPORTS;
        await manager.query(
          'UPDATE report_targets SET report_count = ?, last_reported_at = ?, state = ? WHERE target_type = ? AND target_id = ?',
          [count, now, autoHide ? 'HIDDEN' : summary.state, target.type, target.id],
        );
        if (autoHide) await this.hide(manager, target, { reason: 'REPORTS', adminId: null }, now);
        return { targetType: target.type, targetId: target.id };
      }),
    );
  }

  async list(query: { cursor?: string; size?: number; state?: 'PENDING' | 'HIDDEN' }) {
    const size = query.size ?? DEFAULT_SIZE;
    const where = [LIVE, query.state ? 'rt.state = ?' : "rt.state IN ('PENDING', 'HIDDEN')"];
    const params: unknown[] = query.state ? [query.state] : [];
    if (query.cursor) {
      const c = decodeReportCursor(query.cursor);
      where.push(
        `(rt.last_reported_at < ? OR (rt.last_reported_at = ? AND (rt.target_id < ? OR (rt.target_id = ? AND (rt.target_type = 'COMMENT') < ?))))`,
      );
      params.push(c.at, c.at, c.id, c.id, c.type === 'COMMENT' ? 1 : 0);
    }
    const rows = (await this.dataSource.query(
      `${TARGET_SQL} WHERE ${where.join(' AND ')}
        ORDER BY rt.last_reported_at DESC, rt.target_id DESC, (rt.target_type = 'COMMENT') DESC LIMIT ?`,
      [...params, size + 1],
    )) as TargetRow[];
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    return {
      items: await this.toItems(page),
      nextCursor:
        rows.length > size && last
          ? encodeReportCursor({ at: last.last_reported_at, type: last.target_type, id: Number(last.target_id) })
          : null,
    };
  }

  async resolve(admin: Viewer, type: ReportTargetType, id: number, action: 'HIDE' | 'CLEAR', now = new Date()) {
    await withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const found = await this.findTarget(manager, type, id);
        if (!found || found.status === 'DELETED') throw Errors.notFound('신고 대상을 찾을 수 없어요');
        const target = await this.lockTarget(manager, found);
        const [summary] = (await manager.query(
          'SELECT state FROM report_targets WHERE target_type = ? AND target_id = ? FOR UPDATE',
          [type, id],
        )) as unknown[];
        if (!summary) throw Errors.notFound('신고 대상을 찾을 수 없어요');
        if (action === 'HIDE') await this.hide(manager, target, { reason: 'ADMIN', adminId: admin.id }, now);
        else await this.unhide(manager, target, now);
        await manager.query(
          'UPDATE report_targets SET state = ?, resolved_at = ?, resolved_by = ? WHERE target_type = ? AND target_id = ?',
          [action === 'HIDE' ? 'HIDDEN' : 'CLEARED', now, admin.id, type, id],
        );
      }),
    );
    const rows = (await this.dataSource.query(`${TARGET_SQL} WHERE rt.target_type = ? AND rt.target_id = ?`, [type, id])) as TargetRow[];
    const [item] = await this.toItems(rows);
    return item;
  }

  private async findTarget(manager: EntityManager, type: ReportTargetType, id: number, lock = false): Promise<Target | undefined> {
    const suffix = lock ? ' FOR UPDATE' : '';
    if (type === 'POST') {
      const [row] = (await manager.query(`SELECT post_id, user_id, status FROM community_posts WHERE post_id = ?${suffix}`, [id])) as {
        user_id: number | string | null;
        status: Status;
      }[];
      if (!row || row.user_id === null) return row ? { type, id, postId: id, authorId: 0, status: 'DELETED', isCommunityPost: true } : undefined;
      return { type, id, postId: id, authorId: Number(row.user_id), status: row.status, isCommunityPost: true };
    }
    const [row] = (await manager.query(`SELECT post_id, user_id, status FROM comments WHERE id = ?${suffix}`, [id])) as {
      post_id: number | string;
      user_id: number | string | null;
      status: Status;
    }[];
    if (!row) return undefined;
    if (row.user_id === null) return { type, id, postId: Number(row.post_id), authorId: 0, status: 'DELETED', isCommunityPost: false };
    return { type, id, postId: Number(row.post_id), authorId: Number(row.user_id), status: row.status, isCommunityPost: false };
  }

  private async lockTarget(manager: EntityManager, found: Target): Promise<Target> {
    await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [found.authorId]);
    await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [found.postId]);
    if (found.type === 'COMMENT') {
      await manager.query('SELECT post_id FROM community_posts WHERE post_id = ? FOR UPDATE', [found.postId]);
    }
    const target = await this.findTarget(manager, found.type, found.id, true);
    if (!target || target.status === 'DELETED' || target.authorId !== found.authorId) throw Errors.notFound('신고할 대상을 찾을 수 없어요');
    return target;
  }

  private async hide(manager: EntityManager, target: Target, by: { reason: HiddenReason; adminId: number | null }, now: Date) {
    if (target.type === 'POST') await hidePost(manager, { id: target.id, authorId: target.authorId }, by, now);
    else await hideComment(manager, { id: target.id, postId: target.postId, authorId: target.authorId }, by, now);
  }

  private async unhide(manager: EntityManager, target: Target, now: Date) {
    if (target.type === 'POST') await unhidePost(manager, { id: target.id, authorId: target.authorId }, now);
    else await unhideComment(manager, { id: target.id, postId: target.postId, authorId: target.authorId }, now);
  }

  private async toItems(rows: TargetRow[]) {
    if (!rows.length) return [];
    const keys = rows.map((r) => [r.target_type, Number(r.target_id)] as const);
    const inList = keys.map(() => '(?, ?)').join(', ');
    const flat = keys.flat();
    const [counts, details] = await Promise.all([
      this.dataSource.query(
        `SELECT target_type, target_id, reason, COUNT(*) AS n FROM reports
          WHERE (target_type, target_id) IN (${inList}) GROUP BY target_type, target_id, reason`,
        flat,
      ) as Promise<{ target_type: string; target_id: number | string; reason: ReportReason; n: number | string }[]>,
      this.dataSource.query(
        `SELECT target_type, target_id, detail FROM reports
          WHERE reason = 'OTHER' AND detail IS NOT NULL AND (target_type, target_id) IN (${inList})
          ORDER BY created_at DESC, id DESC`,
        flat,
      ) as Promise<{ target_type: string; target_id: number | string; detail: string }[]>,
    ]);
    const key = (type: string, id: number | string) => `${type}:${Number(id)}`;
    const reasons = new Map<string, Record<ReportReason, number>>();
    for (const c of counts) {
      const k = key(c.target_type, c.target_id);
      const entry = reasons.get(k) ?? (Object.fromEntries(REPORT_REASONS.map((r) => [r, 0])) as Record<ReportReason, number>);
      entry[c.reason] = Number(c.n);
      reasons.set(k, entry);
    }
    const notes = new Map<string, string[]>();
    for (const d of details) {
      const k = key(d.target_type, d.target_id);
      const list = notes.get(k) ?? [];
      if (list.length < DETAILS_MAX) list.push(d.detail);
      notes.set(k, list);
    }
    return rows.map((r) => {
      const k = key(r.target_type, r.target_id);
      const isPost = r.target_type === 'POST';
      const authorId = isPost ? r.p_author_id : r.c_author_id;
      const nickname = isPost ? r.p_author_nickname : r.c_author_nickname;
      const status = (isPost ? r.p_status : r.c_status) === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE';
      return {
        targetType: r.target_type,
        targetId: Number(r.target_id),
        postId: isPost ? Number(r.target_id) : Number(r.c_post_id),
        state: r.state,
        reportCount: Number(r.report_count),
        reasons: reasons.get(k) ?? (Object.fromEntries(REPORT_REASONS.map((x) => [x, 0])) as Record<ReportReason, number>),
        details: notes.get(k) ?? [],
        lastReportedAt: r.last_reported_at,
        preview: {
          title: isPost ? r.p_title : null,
          text: clip(isPost ? r.p_summary : r.c_body),
          author: authorId != null && nickname != null ? { id: Number(authorId), nickname } : null,
          status,
          hiddenReason: status === 'HIDDEN' ? ((isPost ? r.p_reason : r.c_reason) ?? null) : null,
        },
      };
    });
  }
}
