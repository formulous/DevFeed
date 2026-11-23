import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DirectoryService } from './directory.service';
import type { NewsRegion } from '../entities/source.entity';
import type { Field } from './fields';
import { PopularPeriod, popularSince } from './period';

export const POPULAR_LIMIT = 20;
export const POPULAR_TTL_MS = 10 * 60 * 1000;

export type TechPopularSort = 'VIEWS' | 'COMMENTS' | 'REACTIONS';
export type SecurityPopularSort = 'VIEWS' | 'REACTIONS';

export interface SortRule {
  score: string;
  order: string;
}

export const POPULAR_SORT: Record<TechPopularSort, SortRule> = {
  VIEWS: { score: 'p.view_count', order: 'p.view_count DESC' },
  COMMENTS: { score: 'p.comment_count', order: 'p.comment_count DESC' },
  REACTIONS: { score: 'p.like_count + p.comment_count', order: 'p.like_count + p.comment_count DESC, p.comment_count DESC' },
};

interface Entry {
  at: number;
  ids: Promise<number[]>;
}

@Injectable()
export class PopularIdsService {
  private readonly cache = new Map<string, Entry>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly directory: DirectoryService,
  ) {}

  ids(period: PopularPeriod, field?: Field, now = Date.now(), sort: TechPopularSort = 'VIEWS'): Promise<number[]> {
    return this.cached(`BLOG:${period}:${field ?? ''}:${sort}`, now, () => this.query(period, field, new Date(now), sort));
  }

  securityIds(period: PopularPeriod, region?: NewsRegion, now = Date.now(), sort: SecurityPopularSort = 'VIEWS'): Promise<number[]> {
    return this.cached(`SECURITY_NEWS:${period}:${region ?? ''}:${sort}`, now, () =>
      this.securityQuery(period, region, new Date(now), sort),
    );
  }

  private cached(key: string, now: number, load: () => Promise<number[]>): Promise<number[]> {
    let entry = this.cache.get(key);
    if (!entry || now - entry.at > POPULAR_TTL_MS) {
      const ids = load().catch((error) => {
        if (this.cache.get(key)?.ids === ids) this.cache.delete(key);
        throw error;
      });
      entry = { at: now, ids };
      this.cache.set(key, entry);
    }
    return entry.ids;
  }

  async badgeSet(now = Date.now()): Promise<Set<number>> {
    return new Set(await this.ids('WEEK', undefined, now));
  }

  private async query(period: PopularPeriod, field: Field | undefined, now: Date, sort: TechPopularSort): Promise<number[]> {
    const rule = POPULAR_SORT[sort];
    const where = ["p.kind = 'BLOG'", 'p.published_at >= ?', `${rule.score} > 0`];
    const params: unknown[] = [popularSince(period, now)];
    if (field) {
      const tagIds = await this.directory.fieldTagIds(field);
      if (!tagIds.length) return [];
      where.push(`EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = p.id AND fx.tag_id IN (${tagIds.map(() => '?').join(', ')}))`);
      params.push(...tagIds);
    }
    return this.top(where, params, rule.order);
  }

  private async securityQuery(period: PopularPeriod, region: NewsRegion | undefined, now: Date, sort: SecurityPopularSort): Promise<number[]> {
    const rule = POPULAR_SORT[sort];
    const where = ["p.kind = 'SECURITY_NEWS'", 'p.published_at >= ?', `${rule.score} > 0`];
    const params: unknown[] = [popularSince(period, now)];
    if (region) {
      const sourceIds = (await this.directory.sourcesOf('SECURITY_NEWS')).filter((s) => s.region === region).map((s) => s.id);
      if (!sourceIds.length) return [];
      where.push(`p.source_id IN (${sourceIds.map(() => '?').join(', ')})`);
      params.push(...sourceIds);
    }
    return this.top(where, params, rule.order);
  }

  private async top(where: string[], params: unknown[], order: string): Promise<number[]> {
    const rows = (await this.dataSource.query(
      `SELECT p.id FROM posts p WHERE ${where.join(' AND ')}
        ORDER BY ${order}, p.published_at DESC, p.id DESC LIMIT ?`,
      [...params, POPULAR_LIMIT],
    )) as { id: number | string }[];
    return rows.map((r) => Number(r.id));
  }
}
