import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { isMissingReference } from '../common/database/mysql-errors';
import { AppException, Errors } from '../common/errors/app.exception';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { viewerKey } from '../common/visitor/visitor';
import type { UserRole } from '../entities/user.entity';
import { withoutViewCount } from '../posts/post-cards';
import { PostCardsService } from '../posts/post-cards.service';
import { removeReactions } from '../reactions/withdraw-reactions';
import { BOOKMARK_LIMIT, bookmarkListQuery, historyListQuery } from './personal-list';

export interface MeResponse {
  id: number;
  email: string;
  nickname: string;
  role: UserRole;
  hasInterestTags: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
}

const DEFAULT_SIZE = 20;
const passwordMismatch = () => new AppException(403, 'PASSWORD_MISMATCH', '비밀번호가 올바르지 않아요');
const bookmarkLimit = () =>
  new AppException(422, 'BOOKMARK_LIMIT_EXCEEDED', `북마크는 최대 ${BOOKMARK_LIMIT.toLocaleString('ko-KR')}개까지 저장할 수 있어요`);

function rethrowMissingUser(error: unknown): never {
  if (isMissingReference(error)) throw Errors.unauthenticated();
  throw error;
}

@Injectable()
export class MeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
  ) {}

  async get(userId: number): Promise<MeResponse> {
    const [row] = (await this.dataSource.query(
      `SELECT u.id, u.email, u.nickname, u.role, u.onboarding_completed_at, u.created_at,
              EXISTS (SELECT 1 FROM user_interest_tags t WHERE t.user_id = u.id) AS has_tags
         FROM users u WHERE u.id = ?`,
      [userId],
    )) as {
      id: number | string;
      email: string;
      nickname: string;
      role: UserRole;
      onboarding_completed_at: Date | null;
      created_at: Date;
      has_tags: number | string;
    }[];
    if (!row) throw Errors.unauthenticated();
    return {
      id: Number(row.id),
      email: row.email,
      nickname: row.nickname,
      role: row.role,
      hasInterestTags: Number(row.has_tags) === 1,
      onboardingCompleted: row.onboarding_completed_at !== null,
      createdAt: row.created_at,
    };
  }

  async updateNickname(userId: number, nickname: string): Promise<MeResponse> {
    await this.dataSource.query('UPDATE users SET nickname = ? WHERE id = ?', [nickname, userId]);
    return this.get(userId);
  }

  async completeOnboarding(userId: number, now = new Date()): Promise<void> {
    const result = (await this.dataSource.query(
      'UPDATE users SET onboarding_completed_at = COALESCE(onboarding_completed_at, ?) WHERE id = ?',
      [now, userId],
    )) as { affectedRows: number };
    if (result.affectedRows === 0) await this.get(userId);
  }

  async interestTags(userId: number) {
    const rows = (await this.dataSource.query(
      `SELECT t.id, t.name FROM user_interest_tags u JOIN tags t ON t.id = u.tag_id
        WHERE u.user_id = ? ORDER BY t.name`,
      [userId],
    )) as { id: number | string; name: string }[];
    return { items: rows.map((r) => ({ id: Number(r.id), name: r.name })) };
  }

  async replaceInterestTags(userId: number, tagIds: number[], now = new Date()) {
    const unique = [...new Set(tagIds)];
    if (unique.length < 3) throw Errors.validation([{ field: 'tagIds', message: '서로 다른 태그를 3~10개 골라 주세요' }]);
    const [{ n }] = (await this.dataSource.query(
      `SELECT COUNT(*) AS n FROM tags WHERE id IN (${unique.map(() => '?').join(', ')})`,
      unique,
    )) as { n: number | string }[];
    if (Number(n) !== unique.length) throw Errors.validation([{ field: 'tagIds', message: '존재하지 않는 태그가 있어요' }]);
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query('DELETE FROM user_interest_tags WHERE user_id = ?', [userId]);
        await manager.query(
          `INSERT INTO user_interest_tags (user_id, tag_id, created_at) VALUES ${unique.map(() => '(?, ?, ?)').join(', ')}`,
          unique.flatMap((tagId) => [userId, tagId, now]),
        );
        await manager.query(
          'UPDATE users SET onboarding_completed_at = COALESCE(onboarding_completed_at, ?) WHERE id = ?',
          [now, userId],
        );
      });
    } catch (error) {
      rethrowMissingUser(error);
    }
    return this.interestTags(userId);
  }

  async addBookmark(userId: number, postId: number, now = new Date()): Promise<void> {
    const [post] = (await this.dataSource.query(
      `SELECT p.id, EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = ? AND b.post_id = p.id) AS saved
         FROM posts p WHERE p.id = ?`,
      [userId, postId],
    )) as { id: number | string; saved: number | string }[];
    if (!post) throw Errors.notFound('글을 찾을 수 없어요');
    if (Number(post.saved) === 1) return;
    const [{ n }] = (await this.dataSource.query('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?', [
      userId,
    ])) as { n: number | string }[];
    if (Number(n) >= BOOKMARK_LIMIT) throw bookmarkLimit();
    try {
      await this.dataSource.query('INSERT IGNORE INTO bookmarks (user_id, post_id, created_at) VALUES (?, ?, ?)', [
        userId,
        postId,
        now,
      ]);
    } catch (error) {
      rethrowMissingUser(error);
    }
  }

  async removeBookmark(userId: number, postId: number): Promise<void> {
    await this.dataSource.query('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?', [userId, postId]);
  }

  async bookmarks(userId: number, query: { cursor?: string; size?: number; tagIds?: number[] }) {
    const size = query.size ?? DEFAULT_SIZE;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const { sql, params } = bookmarkListQuery(userId, size + 1, cursor, query.tagIds);
    const [rows, totals] = await Promise.all([
      this.dataSource.query(sql, params) as Promise<{ id: number | string; at: Date }[]>,
      this.dataSource.query('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?', [userId]) as Promise<
        { n: number | string }[]
      >,
    ]);
    const page = this.page(rows, size);
    const at = new Map(page.rows.map((r) => [Number(r.id), r.at]));
    const cards = await this.cards.load(page.rows.map((r) => Number(r.id)), userId);
    return {
      items: cards.map((card) => ({ ...withoutViewCount(card), bookmarkedAt: at.get(card.id) })),
      nextCursor: page.nextCursor,
      total: Number(totals[0].n),
    };
  }

  async history(userId: number, query: { cursor?: string; size?: number }) {
    const size = query.size ?? DEFAULT_SIZE;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const { sql, params } = historyListQuery(userId, size + 1, cursor);
    const rows = (await this.dataSource.query(sql, params)) as { id: number | string; at: Date }[];
    const page = this.page(rows, size);
    const at = new Map(page.rows.map((r) => [Number(r.id), r.at]));
    const cards = await this.cards.load(page.rows.map((r) => Number(r.id)), userId);
    return {
      items: cards.map((card) => ({ ...withoutViewCount(card), readAt: at.get(card.id) })),
      nextCursor: page.nextCursor,
    };
  }

  async removeHistory(userId: number, postId?: number): Promise<void> {
    if (postId === undefined) {
      await this.dataSource.query('DELETE FROM read_histories WHERE user_id = ?', [userId]);
    } else {
      await this.dataSource.query('DELETE FROM read_histories WHERE user_id = ? AND post_id = ?', [userId, postId]);
    }
  }

  async withdraw(userId: number, password: string): Promise<void> {
    const [user] = (await this.dataSource.query('SELECT password_hash FROM users WHERE id = ?', [userId])) as {
      password_hash: string;
    }[];
    if (!user) throw Errors.unauthenticated();
    if (!(await bcrypt.compare(password, user.password_hash))) throw passwordMismatch();
    await this.dataSource.transaction(async (manager) => {
      await manager.query('UPDATE recommendation_impressions SET user_id = NULL WHERE user_id = ?', [userId]);
      await manager.query('DELETE FROM post_view_guards WHERE viewer_key = ?', [viewerKey({ userId })]);
      await removeReactions(manager, userId);
      await manager.query('DELETE FROM users WHERE id = ?', [userId]);
    });
  }

  private page(rows: { id: number | string; at: Date }[], size: number) {
    const pageRows = rows.slice(0, size);
    const last = pageRows[pageRows.length - 1];
    return {
      rows: pageRows,
      nextCursor: rows.length > size && last ? encodeCursor({ at: last.at, id: Number(last.id) }) : null,
    };
  }
}
