import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PublicTagsQuery } from './catalog.dto';
import { TagCountsService } from './tag-counts.service';

const SOURCES_TTL_MS = 60 * 1000;

@Injectable()
export class CatalogService {
  private sourcesCache: { at: number; value: Promise<unknown> } | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly counts: TagCountsService,
  ) {}

  async tags(query: PublicTagsQuery) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (query.q) {
      const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push('(t.name LIKE ? OR EXISTS (SELECT 1 FROM tag_synonyms s WHERE s.tag_id = t.id AND s.synonym LIKE ?))');
      params.push(like, like);
    }
    if (query.category) {
      where.push('t.category = ?');
      params.push(query.category);
    }
    const rows = (await this.dataSource.query(
      `SELECT t.id, t.name, t.slug, t.category FROM tags t
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.name`,
      params,
    )) as { id: number | string; name: string; slug: string; category: string | null }[];
    const counts = await this.counts.get();
    const items = rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      slug: r.slug,
      category: r.category,
      postCount: counts.get(Number(r.id)) ?? 0,
    }));
    if (query.sort === 'POST_COUNT') items.sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name));
    return { items: items.slice(0, query.size ?? 500) };
  }

  sources(now = Date.now()) {
    if (!this.sourcesCache || now - this.sourcesCache.at > SOURCES_TTL_MS) {
      const value = this.loadSources().catch((error) => {
        this.sourcesCache = null;
        throw error;
      });
      this.sourcesCache = { at: now, value };
    }
    return this.sourcesCache.value;
  }

  private async loadSources() {
    const rows = (await this.dataSource.query(
      'SELECT id, name, logo_url, source_type FROM sources ORDER BY name, id',
    )) as { id: number | string; name: string; logo_url: string | null; source_type: string }[];
    return {
      items: rows.map((r) => ({ id: Number(r.id), name: r.name, logoUrl: r.logo_url, type: r.source_type })),
    };
  }
}
