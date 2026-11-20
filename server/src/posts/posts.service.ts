import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { buildFeedQuery } from './feed-query';
import { FeedQuery } from './dto/posts.dto';
import { PopularPeriod } from './period';
import { PopularIdsService } from './popular-ids.service';
import { PostCardsService } from './post-cards.service';
import { PostSummary, withoutViewCount } from './post-cards';

const DEFAULT_SIZE = 20;

type PopularCard = Omit<PostSummary, 'isBookmarked' | 'isRead'> & { viewCount: number };

@Injectable()
export class PostsService {
  private readonly popularCache = new Map<PopularPeriod, { ids: number[]; cards: Promise<PopularCard[]> }>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
    private readonly popularIds: PopularIdsService,
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
    const ids = await this.popularIds.ids(period, now);
    let entry = this.popularCache.get(period);
    if (!entry || entry.ids !== ids) {
      const cards = this.cards.load(ids).catch((error) => {
        if (this.popularCache.get(period)?.cards === cards) this.popularCache.delete(period);
        throw error;
      });
      entry = { ids, cards };
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
}
