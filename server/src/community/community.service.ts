import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { withDeadlockRetry } from '../common/database/deadlock-retry';
import { AppException, Errors } from '../common/errors/app.exception';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import { PopularPeriod, popularSince } from '../posts/period';
import { POPULAR_LIMIT, POPULAR_TTL_MS } from '../posts/popular-ids.service';
import { PostCardsService } from '../posts/post-cards.service';
import { CommunityCategory, withoutViewCount } from '../posts/post-cards';
import type { Viewer } from '../reactions/comment-view';
import { awardPostWrite, revokeLikesReceived, setPostWriteRevoked } from '../score/score-ledger';
import { kstDayStart } from '../score/score-policy';
import { indexCommunityPost, replaceTags, softDeletePost } from './community-store';
import { CreateCommunityPostDto, UpdateCommunityPostDto } from './dto/community.dto';
import { markdownExcerpt } from './markdown-excerpt';
import { hidePost, resolveReportTarget, unhidePost } from './moderation';
import { postWriteStatus } from './write-limit';

const DEFAULT_SIZE = 20;

type Status = 'VISIBLE' | 'HIDDEN' | 'DELETED';

interface CommunityRow {
  post_id: number | string;
  user_id: number | string | null;
  category: CommunityCategory;
  body: string | null;
  status: Status;
  accepted_comment_id: number | string | null;
  published_at: Date;
}

const postNotFound = () => Errors.notFound('글을 찾을 수 없어요');
const notMine = () => new AppException(403, 'FORBIDDEN', '내 글만 수정할 수 있어요');

export type CommunityPopularSort = 'SCORE' | 'COMMENTS' | 'LIKES';

const COMMUNITY_SORT: Record<CommunityPopularSort, string> = {
  SCORE: 'p.like_count * 2 + p.comment_count + p.view_count * 0.1',
  COMMENTS: 'p.comment_count',
  LIKES: 'p.like_count',
};

@Injectable()
export class CommunityService {
  private sourceId?: Promise<number>;
  private readonly popularCache = new Map<string, { at: number; ids: Promise<number[]> }>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async list(query: { cursor?: string; size?: number; category?: CommunityCategory }, userId?: number) {
    const size = query.size ?? DEFAULT_SIZE;
    const where = ["cp.status = 'VISIBLE'"];
    const params: unknown[] = [];
    if (query.category) {
      where.push('cp.category = ?');
      params.push(query.category);
    }
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      where.push('(cp.published_at < ? OR (cp.published_at = ? AND cp.post_id < ?))');
      params.push(cursor.at, cursor.at, cursor.id);
    }
    const rows = (await this.dataSource.query(
      `SELECT cp.post_id, cp.published_at FROM community_posts cp WHERE ${where.join(' AND ')}
        ORDER BY cp.published_at DESC, cp.post_id DESC LIMIT ?`,
      [...params, size + 1],
    )) as { post_id: number | string; published_at: Date }[];
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    const items = await this.cards.load(page.map((r) => Number(r.post_id)), userId);
    return {
      items: items.map(withoutViewCount),
      nextCursor: rows.length > size && last ? encodeCursor({ at: last.published_at, id: Number(last.post_id) }) : null,
    };
  }

  async popular(period: PopularPeriod, category?: CommunityCategory, userId?: number, now = Date.now(), sort: CommunityPopularSort = 'SCORE') {
    const key = `${period}:${category ?? ''}:${sort}`;
    let entry = this.popularCache.get(key);
    if (!entry || now - entry.at > POPULAR_TTL_MS) {
      const ids = this.popularIds(period, category, new Date(now), sort).catch((error) => {
        if (this.popularCache.get(key)?.ids === ids) this.popularCache.delete(key);
        throw error;
      });
      entry = { at: now, ids };
      this.popularCache.set(key, entry);
    }
    const ids = await entry.ids;
    if (!ids.length) return { items: [] };
    const visible = (await this.dataSource.query(
      `SELECT post_id FROM community_posts WHERE status = 'VISIBLE' AND post_id IN (${ids.map(() => '?').join(', ')})`,
      ids,
    )) as { post_id: number | string }[];
    const keep = new Set(visible.map((r) => Number(r.post_id)));
    return { items: await this.cards.load(ids.filter((id) => keep.has(id)), userId) };
  }

  async writeStatus(userId: number, now = new Date()) {
    const status = await this.computeWriteStatus(this.dataSource.manager, userId, now, false);
    return { ...status, availableAt: status.availableAt?.toISOString() ?? null };
  }

  async create(user: Viewer, dto: CreateCommunityPostDto, now = new Date()) {
    const tagIds = dto.tagIds ?? [];
    await this.assertTags(tagIds);
    const sourceId = await this.internalSource();
    const postId = await withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const status = await this.computeWriteStatus(manager, user.id, now, true);
        if (!status.allowed && status.reason && status.availableAt && status.retryAfterSec) {
          throw Errors.postWriteLimited(status.reason, status.retryAfterSec, status.availableAt);
        }
        const inserted = (await manager.query(
          `INSERT INTO posts (source_id, source_type, kind, url, title, summary, published_at)
           VALUES (?, 'PERSONAL', 'COMMUNITY', CONCAT('internal:community:', UUID()), ?, ?, ?)`,
          [sourceId, dto.title, markdownExcerpt(dto.body) || null, now],
        )) as { insertId: number };
        const id = Number(inserted.insertId);
        await manager.query('UPDATE posts SET url = ? WHERE id = ?', [this.postUrl(id), id]);
        await manager.query(
          'INSERT INTO community_posts (post_id, user_id, category, body, published_at) VALUES (?, ?, ?, ?, ?)',
          [id, user.id, dto.category, dto.body, now],
        );
        await replaceTags(manager, id, now, tagIds);
        await indexCommunityPost(manager, id);
        await awardPostWrite(manager, user.id, id, now);
        return id;
      }),
    );
    return this.detail(postId, user);
  }

  async detail(postId: number, viewer?: Viewer) {
    const row = await this.find(this.dataSource.manager, postId);
    if (!row) throw postNotFound();
    const authorId = row.user_id === null ? null : Number(row.user_id);
    if (row.status === 'HIDDEN' && viewer?.role !== 'ADMIN' && authorId !== viewer?.id) throw postNotFound();
    if (row.status === 'DELETED') {
      const [comment] = (await this.dataSource.query('SELECT id FROM comments WHERE post_id = ? LIMIT 1', [postId])) as unknown[];
      if (!comment) throw postNotFound();
    }
    const [[card], reported] = await Promise.all([
      this.cards.load([postId], viewer?.id),
      viewer
        ? (this.dataSource.query("SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = 'POST' AND target_id = ?", [
            viewer.id,
            postId,
          ]) as Promise<unknown[]>)
        : Promise.resolve([]),
    ]);
    if (!card) throw postNotFound();
    return {
      ...withoutViewCount(card),
      body: row.body,
      status: row.status,
      acceptedCommentId: row.accepted_comment_id === null ? null : Number(row.accepted_comment_id),
      mine: viewer !== undefined && authorId !== null && authorId === viewer.id,
      reportedByMe: reported.length > 0,
    };
  }

  async update(user: Viewer, postId: number, dto: UpdateCommunityPostDto, now = new Date()) {
    if (dto.category === undefined && dto.title === undefined && dto.body === undefined && dto.tagIds === undefined) {
      throw Errors.validation([{ field: 'body', message: '바꿀 내용을 하나 이상 보내 주세요' }]);
    }
    if (dto.tagIds) await this.assertTags(dto.tagIds);
    await withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId]);
        const row = await this.find(manager, postId, true);
        if (!row || row.status === 'DELETED') throw postNotFound();
        if (Number(row.user_id) !== user.id) throw notMine();
        if (row.status === 'HIDDEN') throw Errors.communityPostClosed();
        const set: string[] = ['edited_at = ?'];
        const params: unknown[] = [now];
        if (dto.category !== undefined) {
          set.push('category = ?');
          params.push(dto.category);
          if (dto.category !== 'QUESTION') set.push('accepted_comment_id = NULL');
        }
        if (dto.body !== undefined) {
          set.push('body = ?');
          params.push(dto.body);
        }
        await manager.query(`UPDATE community_posts SET ${set.join(', ')} WHERE post_id = ?`, [...params, postId]);
        if (dto.title !== undefined) await manager.query('UPDATE posts SET title = ? WHERE id = ?', [dto.title, postId]);
        if (dto.body !== undefined) {
          await manager.query('UPDATE posts SET summary = ? WHERE id = ?', [markdownExcerpt(dto.body) || null, postId]);
        }
        if (dto.tagIds !== undefined) await replaceTags(manager, postId, row.published_at, dto.tagIds);
        if (dto.title !== undefined || dto.body !== undefined || dto.tagIds !== undefined) await indexCommunityPost(manager, postId);
      }),
    );
    return this.detail(postId, user);
  }

  remove(user: Viewer, postId: number, now = new Date()): Promise<void> {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const found = await this.find(manager, postId);
        if (!found || found.status === 'DELETED' || found.user_id === null) throw postNotFound();
        const authorId = Number(found.user_id);
        if (authorId !== user.id && user.role !== 'ADMIN') throw Errors.forbidden();
        await this.lockAuthor(manager, authorId, postId);
        const row = await this.find(manager, postId, true);
        if (!row || row.status === 'DELETED' || Number(row.user_id) !== authorId) throw postNotFound();
        await softDeletePost(manager, postId);
        await setPostWriteRevoked(manager, authorId, postId, true, now);
        await revokeLikesReceived(manager, authorId, postId);
      }),
    );
  }

  accept(user: Viewer, postId: number, commentId: number | null) {
    return withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId]);
        const row = await this.find(manager, postId, true);
        if (!row || row.status === 'DELETED') throw postNotFound();
        if (Number(row.user_id) !== user.id) throw Errors.forbidden();
        if (commentId !== null) {
          if (row.status === 'HIDDEN') throw Errors.communityPostClosed();
          if (row.category !== 'QUESTION') throw Errors.acceptNotQuestion();
          const [comment] = (await manager.query(
            'SELECT id, post_id, parent_id, user_id, status FROM comments WHERE id = ? FOR UPDATE',
            [commentId],
          )) as { post_id: number | string; parent_id: number | string | null; user_id: number | string | null; status: Status }[];
          if (!comment || Number(comment.post_id) !== postId || comment.status !== 'VISIBLE') {
            throw Errors.notFound('댓글을 찾을 수 없어요');
          }
          if (comment.parent_id !== null) throw Errors.acceptReply();
          if (Number(comment.user_id) === user.id) throw Errors.acceptOwnComment();
        }
        await manager.query('UPDATE community_posts SET accepted_comment_id = ? WHERE post_id = ?', [commentId, postId]);
        return { acceptedCommentId: commentId, solved: commentId !== null && row.category === 'QUESTION' };
      }),
    );
  }

  async setHidden(admin: Viewer, postId: number, hidden: boolean, now = new Date()) {
    await withDeadlockRetry(() =>
      this.dataSource.transaction(async (manager) => {
        const found = await this.find(manager, postId);
        if (!found || found.status === 'DELETED' || found.user_id === null) throw postNotFound();
        const authorId = Number(found.user_id);
        await this.lockAuthor(manager, authorId, postId);
        const row = await this.find(manager, postId, true);
        if (!row || row.status === 'DELETED' || Number(row.user_id) !== authorId) throw postNotFound();
        const ref = { id: postId, authorId };
        if (hidden) await hidePost(manager, ref, { reason: 'ADMIN', adminId: admin.id }, now);
        else await unhidePost(manager, ref, now);
        await resolveReportTarget(manager, 'POST', postId, hidden ? 'HIDDEN' : 'CLEARED', admin.id, now);
      }),
    );
    return this.detail(postId, admin);
  }

  private async computeWriteStatus(manager: EntityManager, userId: number, now: Date, lock: boolean) {
    const [user] = (await manager.query(`SELECT created_at, role FROM users WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [
      userId,
    ])) as { created_at: Date; role: 'USER' | 'ADMIN' }[];
    if (!user) throw Errors.unauthenticated();
    const [stats] = (await manager.query(
      `SELECT COUNT(CASE WHEN created_at >= ? THEN 1 END) AS today, MAX(created_at) AS last_at
         FROM score_events WHERE user_id = ? AND kind = 'POST_WRITE'`,
      [kstDayStart(now), userId],
    )) as { today: number | string; last_at: Date | null }[];
    return postWriteStatus({
      isAdmin: user.role === 'ADMIN',
      newAccountLimit: this.env.postNewAccountLimitEnabled,
      accountCreatedAt: user.created_at,
      todayCount: Number(stats.today),
      lastWrittenAt: stats.last_at,
      now,
    });
  }

  private async popularIds(period: PopularPeriod, category: CommunityCategory | undefined, now: Date, sort: CommunityPopularSort): Promise<number[]> {
    const order = COMMUNITY_SORT[sort];
    const where = ["cp.status = 'VISIBLE'", 'cp.published_at >= ?'];
    if (sort !== 'SCORE') where.push(`${order} > 0`);
    const params: unknown[] = [popularSince(period, now)];
    if (category) {
      where.push('cp.category = ?');
      params.push(category);
    }
    const rows = (await this.dataSource.query(
      `SELECT p.id FROM community_posts cp JOIN posts p ON p.id = cp.post_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${order} DESC, p.published_at DESC, p.id DESC LIMIT ?`,
      [...params, POPULAR_LIMIT],
    )) as { id: number | string }[];
    return rows.map((r) => Number(r.id));
  }

  private async find(manager: EntityManager, postId: number, lock = false): Promise<CommunityRow | undefined> {
    const [row] = (await manager.query(
      `SELECT post_id, user_id, category, body, status, accepted_comment_id, published_at
         FROM community_posts WHERE post_id = ?${lock ? ' FOR UPDATE' : ''}`,
      [postId],
    )) as CommunityRow[];
    return row;
  }

  private async lockAuthor(manager: EntityManager, authorId: number, postId: number): Promise<void> {
    await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [authorId]);
    await manager.query('SELECT id FROM posts WHERE id = ? FOR UPDATE', [postId]);
  }

  private async assertTags(tagIds: number[]): Promise<void> {
    if (!tagIds.length) return;
    const [{ n }] = (await this.dataSource.query(
      `SELECT COUNT(*) AS n FROM tags WHERE id IN (${tagIds.map(() => '?').join(', ')})`,
      tagIds,
    )) as { n: number | string }[];
    if (Number(n) !== new Set(tagIds).size) throw Errors.validation([{ field: 'tagIds', message: '없는 태그가 있어요' }]);
  }

  private internalSource(): Promise<number> {
    if (!this.sourceId) {
      this.sourceId = (
        this.dataSource.query("SELECT id FROM sources WHERE kind = 'COMMUNITY' ORDER BY id LIMIT 1") as Promise<
          { id: number | string }[]
        >
      ).then(([row]) => {
        if (!row) throw new Error('커뮤니티 내부 소스가 없음 (0015 확인)');
        return Number(row.id);
      });
      this.sourceId.catch(() => (this.sourceId = undefined));
    }
    return this.sourceId;
  }

  private postUrl(id: number): string {
    return `${this.env.webBaseUrl}/community/posts/${id}`;
  }
}
