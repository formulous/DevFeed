import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { buildFeedQuery } from './feed-query';
import { FeedQuery, SecurityNewsQuery } from './dto/posts.dto';
import { DirectoryService } from './directory.service';
import type { NewsRegion } from '../entities/source.entity';
import type { Field } from './fields';
import { PopularPeriod } from './period';
import { PopularIdsService, TechPopularSort } from './popular-ids.service';
import { PostCardsService } from './post-cards.service';
import { PostSummary, withoutViewCount } from './post-cards';

const DEFAULT_SIZE = 20;

type PopularCard = Omit<PostSummary, 'isBookmarked' | 'isRead'> & { viewCount: number };

@Injectable()
export class PostsService {
  private readonly popularCache = new Map<string, { ids: number[]; cards: Promise<PopularCard[]> }>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
    private readonly popularIds: PopularIdsService,
    private readonly directory: DirectoryService,
  ) {}

  async feed(query: FeedQuery, userId?: number) {
    const size = query.size ?? DEFAULT_SIZE;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const fieldTagIds = query.field ? await this.directory.fieldTagIds(query.field) : undefined;
    const sourceIds = query.sourceIds?.length
      ? await this.directory.keepSourcesOf('BLOG', query.sourceIds)
      : undefined;
    if ((fieldTagIds && !fieldTagIds.length) || (sourceIds && !sourceIds.length)) return { items: [], nextCursor: null };
    const { sql, params } = buildFeedQuery({
      kind: 'BLOG',
      tagIds: query.tagIds,
      fieldTagIds,
      sourceIds,
      sourceType: query.sourceType,
      cursor,
      limit: size + 1,
    });
    return this.page(sql, params, size, userId);
  }

  async securityNews(query: SecurityNewsQuery, userId?: number) {
    const size = query.size ?? DEFAULT_SIZE;
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    let sourceIds: number[] | undefined;
    if (query.region || query.sourceIds?.length) {
      const wanted = query.sourceIds?.length ? new Set(query.sourceIds) : null;
      sourceIds = (await this.directory.sourcesOf('SECURITY_NEWS'))
        .filter((s) => (!query.region || s.region === query.region) && (!wanted || wanted.has(s.id)))
        .map((s) => s.id);
      if (!sourceIds.length) return { items: [], nextCursor: null };
    }
    const { sql, params } = buildFeedQuery({ kind: 'SECURITY_NEWS', sourceIds, cursor, limit: size + 1 });
    return this.page(sql, params, size, userId);
  }

  async securityNewsSources() {
    const order = { DOMESTIC: 0, OVERSEAS: 1 };
    const sources = await this.directory.sourcesOf('SECURITY_NEWS');
    return {
      items: sources
        .map((s) => ({ id: s.id, name: s.name, logoUrl: s.logoUrl, region: s.region ?? 'OVERSEAS' }))
        .sort((a, b) => order[a.region] - order[b.region] || a.name.localeCompare(b.name) || a.id - b.id),
    };
  }

  async page(sql: string, params: unknown[], size: number, userId?: number) {
    const rows = (await this.dataSource.query(sql, params)) as { id: number | string; published_at: Date }[];
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > size && last ? encodeCursor({ at: last.published_at, id: Number(last.id) }) : null;
    const items = await this.cards.load(page.map((r) => Number(r.id)), userId);
    return { items: items.map(withoutViewCount), nextCursor };
  }

  async popular(period: PopularPeriod, field?: Field, userId?: number, now = Date.now(), sort: TechPopularSort = 'VIEWS') {
    const ids = await this.popularIds.ids(period, field, now, sort);
    return this.popularCards(`BLOG:${period}:${field ?? ''}:${sort}`, ids, userId);
  }

  async securityPopular(period: PopularPeriod, region?: NewsRegion, userId?: number, now = Date.now()) {
    const ids = await this.popularIds.securityIds(period, region, now);
    return this.popularCards(`SECURITY_NEWS:${period}:${region ?? ''}`, ids, userId);
  }

  private async popularCards(key: string, ids: number[], userId?: number) {
    let entry = this.popularCache.get(key);
    if (!entry || entry.ids !== ids) {
      const cards = this.cards.load(ids).catch((error) => {
        if (this.popularCache.get(key)?.cards === cards) this.popularCache.delete(key);
        throw error;
      });
      entry = { ids, cards };
      this.popularCache.set(key, entry);
    }
    const cached = await entry.cards;
    if (userId === undefined) return { items: cached };
    const flags = cached.length ? await this.cards.flags(userId, cached.map((c) => c.id)) : null;
    return {
      items: cached.map((card) => ({
        ...card,
        isBookmarked: flags?.bookmarked.has(card.id) ?? false,
        isRead: flags?.read.has(card.id) ?? false,
        likedByMe: flags?.liked.has(card.id) ?? false,
      })),
    };
  }
}
