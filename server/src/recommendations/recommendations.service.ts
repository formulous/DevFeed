import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { addDays } from '../common/time/time';
import { withoutViewCount } from '../posts/post-cards';
import { PostCardsService } from '../posts/post-cards.service';
import {
  Candidate,
  CANDIDATE_WINDOW_DAYS,
  coldItems,
  computePreferences,
  diversify,
  fillToMinimum,
  MAX_RANKED,
  RankedItem,
  reasonLabel,
  scoreCandidates,
  Signal,
  SIGNAL_WINDOW_DAYS,
  toReasons,
  topPreferredTags,
} from './scoring';
import { decodeRecommendationCursor, encodeRecommendationCursor, Snapshot, SnapshotStore, uuidToBuffer } from './snapshot';

const DEFAULT_SIZE = 20;
const COLD_LIMIT = MAX_RANKED + 100;

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly snapshots = new SnapshotStore();

  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
  ) {}

  async page(userId: number, query: { cursor?: string; size?: number }, now = new Date()) {
    const size = query.size ?? DEFAULT_SIZE;
    let snapshot: Snapshot;
    let offset = 0;
    if (query.cursor) {
      const decoded = decodeRecommendationCursor(query.cursor);
      snapshot = this.snapshots.get(decoded.snapshotId, userId);
      offset = decoded.offset;
    } else {
      const { items, fallback } = await this.compute(userId, now);
      snapshot = this.snapshots.save(userId, items, fallback);
    }

    const slice = snapshot.items.slice(offset, offset + size);
    const tagNames = await this.tagNames(slice);
    const reasons = new Map(slice.map((item) => [item.postId, toReasons(item, tagNames)]));
    const recommendationId = randomUUID();
    await this.recordImpressions(recommendationId, userId, slice, offset, reasons, now);

    const cards = await this.cards.load(slice.map((item) => item.postId), userId);
    const nextOffset = offset + slice.length;
    return {
      items: cards.map((card) => ({ ...withoutViewCount(card), reasons: reasons.get(card.id)! })),
      nextCursor: nextOffset < snapshot.items.length ? encodeRecommendationCursor(snapshot.id, nextOffset) : null,
      recommendationId,
      fallback: snapshot.fallback,
    };
  }

  async compute(userId: number, now: Date): Promise<{ items: RankedItem[]; fallback: boolean }> {
    const prefs = computePreferences(await this.signals(userId, now), now);
    const since = addDays(now, -CANDIDATE_WINDOW_DAYS);
    const cold = await this.coldCandidates(userId, since);
    if (!prefs.size) return { items: diversify(cold.slice(0, MAX_RANKED)), fallback: true };

    const candidates = await this.candidates(topPreferredTags(prefs), since);
    const excluded = await this.excludedPosts(userId, candidates.map((c) => c.postId));
    const ranked = scoreCandidates(candidates.filter((c) => !excluded.has(c.postId)), prefs, now);
    return { items: diversify(fillToMinimum(ranked, cold)), fallback: false };
  }

  private async signals(userId: number, now: Date): Promise<Signal[]> {
    const since = addDays(now, -SIGNAL_WINDOW_DAYS);
    const [interest, bookmarks, reads] = await Promise.all([
      this.dataSource.query('SELECT tag_id FROM user_interest_tags WHERE user_id = ?', [userId]) as Promise<
        { tag_id: number | string }[]
      >,
      this.dataSource.query(
        `SELECT pt.tag_id, b.created_at AS at FROM bookmarks b JOIN post_tags pt ON pt.post_id = b.post_id
          WHERE b.user_id = ? AND b.created_at >= ?`,
        [userId, since],
      ) as Promise<{ tag_id: number | string; at: Date }[]>,
      this.dataSource.query(
        `SELECT pt.tag_id, h.last_read_at AS at FROM read_histories h JOIN post_tags pt ON pt.post_id = h.post_id
          WHERE h.user_id = ? AND h.last_read_at >= ?`,
        [userId, since],
      ) as Promise<{ tag_id: number | string; at: Date }[]>,
    ]);
    return [
      ...interest.map((r): Signal => ({ kind: 'INTEREST', tagId: Number(r.tag_id) })),
      ...bookmarks.map((r): Signal => ({ kind: 'BOOKMARK', tagId: Number(r.tag_id), at: r.at })),
      ...reads.map((r): Signal => ({ kind: 'READ', tagId: Number(r.tag_id), at: r.at })),
    ];
  }

  private async candidates(tagIds: number[], since: Date): Promise<Candidate[]> {
    if (!tagIds.length) return [];
    const rows = (await this.dataSource.query(
      `SELECT pt.post_id, pt.tag_id, p.source_id, p.view_count, p.published_at
         FROM post_tags pt JOIN posts p ON p.id = pt.post_id
        WHERE pt.tag_id IN (${tagIds.map(() => '?').join(', ')}) AND pt.published_at >= ?`,
      [...tagIds, since],
    )) as { post_id: number | string; tag_id: number | string; source_id: number | string; view_count: number; published_at: Date }[];
    const byPost = new Map<number, Candidate>();
    for (const row of rows) {
      const postId = Number(row.post_id);
      const candidate = byPost.get(postId) ?? {
        postId,
        sourceId: Number(row.source_id),
        viewCount: Number(row.view_count),
        publishedAt: row.published_at,
        tagIds: [],
      };
      candidate.tagIds.push(Number(row.tag_id));
      byPost.set(postId, candidate);
    }
    return [...byPost.values()];
  }

  private async excludedPosts(userId: number, postIds: number[]): Promise<Set<number>> {
    if (!postIds.length) return new Set();
    const flags = await this.cards.flags(userId, postIds);
    return new Set([...flags.read, ...flags.bookmarked]);
  }

  private async coldCandidates(userId: number, since: Date): Promise<RankedItem[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, source_id FROM posts WHERE published_at >= ?
        ORDER BY view_count DESC, published_at DESC, id DESC LIMIT ?`,
      [since, COLD_LIMIT],
    )) as { id: number | string; source_id: number | string }[];
    const excluded = await this.excludedPosts(userId, rows.map((r) => Number(r.id)));
    return coldItems(
      rows.filter((r) => !excluded.has(Number(r.id))).map((r) => ({ postId: Number(r.id), sourceId: Number(r.source_id) })),
    );
  }

  private async tagNames(items: RankedItem[]): Promise<Map<number, string>> {
    const ids = [...new Set(items.flatMap((i) => i.reasonTags.map((r) => r.tagId)))];
    if (!ids.length) return new Map();
    const rows = (await this.dataSource.query(`SELECT id, name FROM tags WHERE id IN (${ids.map(() => '?').join(', ')})`, ids)) as {
      id: number | string;
      name: string;
    }[];
    return new Map(rows.map((r) => [Number(r.id), r.name]));
  }

  private async recordImpressions(
    recommendationId: string,
    userId: number,
    items: RankedItem[],
    offset: number,
    reasons: Map<number, ReturnType<typeof toReasons>>,
    now: Date,
  ): Promise<void> {
    if (!items.length) return;
    const requestId = uuidToBuffer(recommendationId);
    try {
      await this.dataSource.query(
        `INSERT INTO recommendation_impressions (request_id, user_id, post_id, algorithm, position, reason, shown_at)
         VALUES ${items.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        items.flatMap((item, i) => [
          requestId,
          userId,
          item.postId,
          item.algorithm,
          offset + i + 1,
          reasonLabel(reasons.get(item.postId)!),
          now,
        ]),
      );
    } catch (error) {
      this.logger.error(`추천 노출 기록 실패 user=${userId}: ${(error as Error).message}`);
    }
  }
}
