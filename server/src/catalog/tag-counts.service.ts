import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const TTL_MS = 10 * 60 * 1000;

@Injectable()
export class TagCountsService {
  private cache: { at: number; counts: Promise<Map<number, number>> } | null = null;

  constructor(private readonly dataSource: DataSource) {}

  get(now = Date.now()): Promise<Map<number, number>> {
    if (!this.cache || now - this.cache.at > TTL_MS) {
      const counts = this.load().catch((error) => {
        this.cache = null;
        throw error;
      });
      this.cache = { at: now, counts };
    }
    return this.cache.counts;
  }

  invalidate(): void {
    this.cache = null;
  }

  private async load(): Promise<Map<number, number>> {
    const rows = (await this.dataSource.query(
      'SELECT tag_id, COUNT(*) AS cnt FROM post_tags GROUP BY tag_id',
    )) as { tag_id: number | string; cnt: number | string }[];
    return new Map(rows.map((r) => [Number(r.tag_id), Number(r.cnt)]));
  }
}
