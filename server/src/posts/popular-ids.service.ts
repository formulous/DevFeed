import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PopularPeriod, popularSince } from './period';

export const POPULAR_LIMIT = 20;
export const POPULAR_TTL_MS = 10 * 60 * 1000;

interface Entry {
  at: number;
  ids: Promise<number[]>;
}

@Injectable()
export class PopularIdsService {
  private readonly cache = new Map<PopularPeriod, Entry>();

  constructor(private readonly dataSource: DataSource) {}

  ids(period: PopularPeriod, now = Date.now()): Promise<number[]> {
    let entry = this.cache.get(period);
    if (!entry || now - entry.at > POPULAR_TTL_MS) {
      const ids = this.query(period, new Date(now)).catch((error) => {
        if (this.cache.get(period)?.ids === ids) this.cache.delete(period);
        throw error;
      });
      entry = { at: now, ids };
      this.cache.set(period, entry);
    }
    return entry.ids;
  }

  async badgeSet(now = Date.now()): Promise<Set<number>> {
    return new Set(await this.ids('WEEK', now));
  }

  private async query(period: PopularPeriod, now: Date): Promise<number[]> {
    const rows = (await this.dataSource.query(
      `SELECT id FROM posts WHERE published_at >= ? AND view_count > 0
        ORDER BY view_count DESC, published_at DESC, id DESC LIMIT ?`,
      [popularSince(period, now), POPULAR_LIMIT],
    )) as { id: number | string }[];
    return rows.map((r) => Number(r.id));
  }
}
