import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DirectoryService } from './directory.service';
import type { NewsRegion } from '../entities/source.entity';
import type { Field } from './fields';
import { PopularPeriod, popularSince } from './period';

export const POPULAR_LIMIT = 20;
export const POPULAR_TTL_MS = 10 * 60 * 1000;

export type TechPopularSort = 'VIEWS' | 'COMMENTS';

const TECH_SORT: Record<TechPopularSort, string> = { VIEWS: 'p.view_count', COMMENTS: 'p.comment_count' };

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

  securityIds(period: PopularPeriod, region?: NewsRegion, now = Date.now()): Promise<number[]> {
    return this.cached(`SECURITY_NEWS:${period}:${region ?? ''}`, now, () => this.securityQuery(period, region, new Date(now)));
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
    const where = ["p.kind = 'BLOG'", 'p.published_at >= ?', `${TECH_SORT[sort]} > 0`];
    const params: unknown[] = [popularSince(period, now)];
    if (field) {
      const tagIds = await this.directory.fieldTagIds(field);
      if (!tagIds.length) return [];
      where.push(`EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = p.id AND fx.tag_id IN (${tagIds.map(() => '?').join(', ')}))`);
      params.push(...tagIds);
    }
    return this.top(where, params, TECH_SORT[sort]);
  }

  private async securityQuery(period: PopularPeriod, region: NewsRegion | undefined, now: Date): Promise<number[]> {
    const where = ["p.kind = 'SECURITY_NEWS'", 'p.published_at >= ?', 'p.view_count > 0'];
    const params: unknown[] = [popularSince(period, now)];
    if (region) {
      const sourceIds = (await this.directory.sourcesOf('SECURITY_NEWS')).filter((s) => s.region === region).map((s) => s.id);
      if (!sourceIds.length) return [];
      where.push(`p.source_id IN (${sourceIds.map(() => '?').join(', ')})`);
      params.push(...sourceIds);
    }
    return this.top(where, params);
  }

  private async top(where: string[], params: unknown[], order = 'p.view_count'): Promise<number[]> {
    const rows = (await this.dataSource.query(
      `SELECT p.id FROM posts p WHERE ${where.join(' AND ')}
        ORDER BY ${order} DESC, p.published_at DESC, p.id DESC LIMIT ?`,
      [...params, POPULAR_LIMIT],
    )) as { id: number | string }[];
    return rows.map((r) => Number(r.id));
  }
}
