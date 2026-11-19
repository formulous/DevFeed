import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { buildFeedQuery } from './feed-query';
import { FeedQuery } from './dto/posts.dto';
import { PopularPeriod, popularSince } from './period';
import { PostCardsService } from './post-cards.service';
import { PostSummary, withoutViewCount } from './post-cards';

const DEFAULT_SIZE = 20;
const POPULAR_LIMIT = 20;
const POPULAR_TTL_MS = 10 * 60 * 1000;

type PopularCard = Omit<PostSummary, 'isBookmarked' | 'isRead'> & { viewCount: number };

@Injectable()
export class PostsService {
  private readonly popularCache = new Map<PopularPeriod, { at: number; cards: Promise<PopularCard[]> }>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
  ) {}

  async feed(query: FeedQuery, userId?: number) {
    const size = query.size ?? DEFAULT_SIZE;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const { sql, params } = buildFeedQuery({
      tagIds: query.tagIds,
      sourceIds: query.sourceIds,
      sourceType: query.sourceType,
      cursor,
      limit: size + 1,
    });
    const rows = (await this.dataSource.query(sql, params)) as { id: number | string; published_at: Date }[];
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > size && last ? encodeCursor({ at: last.published_at, id: Number(last.id) }) : null;
    const items = await this.cards.load(page.map((r) => Number(r.id)), userId);
    return { items: items.map(withoutViewCount), nextCursor };
  }

  async popular(period: PopularPeriod, userId?: number, now = Date.now()) {
    let entry = this.popularCache.get(period);
    if (!entry || now - entry.at > POPULAR_TTL_MS) {
      const cards = this.loadPopular(period, new Date(now)).catch((error) => {
        this.popularCache.delete(period);
        throw error;
      });
      entry = { at: now, cards };
      this.popularCache.set(period, entry);
    }
    const cached = await entry.cards;
    if (userId === undefined) return { items: cached };
    const flags = cached.length ? await this.cards.flags(userId, cached.map((c) => c.id)) : null;
    return {
      items: cached.map((card) => ({
        ...card,
        isBookmarked: flags?.bookmarked.has(card.id) ?? false,
        isRead: flags?.read.has(card.id) ?? false,
      })),
    };
  }

  private async loadPopular(period: PopularPeriod, now: Date): Promise<PopularCard[]> {
    const rows = (await this.dataSource.query(
      `SELECT id FROM posts WHERE published_at >= ?
        ORDER BY view_count DESC, published_at DESC, id DESC LIMIT ?`,
      [popularSince(period, now), POPULAR_LIMIT],
    )) as { id: number | string }[];
    return this.cards.load(rows.map((r) => Number(r.id)));
  }
}
