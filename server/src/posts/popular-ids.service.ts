import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DirectoryService } from './directory.service';
import type { Field } from './fields';
import { PopularPeriod, popularSince } from './period';

export const POPULAR_LIMIT = 20;
export const POPULAR_TTL_MS = 10 * 60 * 1000;

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

  ids(period: PopularPeriod, field?: Field, now = Date.now()): Promise<number[]> {
    const key = `${period}:${field ?? ''}`;
    let entry = this.cache.get(key);
    if (!entry || now - entry.at > POPULAR_TTL_MS) {
      const ids = this.query(period, field, new Date(now)).catch((error) => {
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

  private async query(period: PopularPeriod, field: Field | undefined, now: Date): Promise<number[]> {
    const where = ["p.kind = 'BLOG'", 'p.published_at >= ?', 'p.view_count > 0'];
    const params: unknown[] = [popularSince(period, now)];
    if (field) {
      const tagIds = await this.directory.fieldTagIds(field);
      if (!tagIds.length) return [];
      where.push(`EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = p.id AND fx.tag_id IN (${tagIds.map(() => '?').join(', ')}))`);
      params.push(...tagIds);
    }
    params.push(POPULAR_LIMIT);
    const rows = (await this.dataSource.query(
      `SELECT p.id FROM posts p WHERE ${where.join(' AND ')}
        ORDER BY p.view_count DESC, p.published_at DESC, p.id DESC LIMIT ?`,
      params,
    )) as { id: number | string }[];
    return rows.map((r) => Number(r.id));
  }
}
