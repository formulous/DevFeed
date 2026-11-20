import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { NewsRegion, SourceKind } from '../entities/source.entity';
import { Field, groupTagsByField } from './fields';

const TTL_MS = 60 * 1000;

export interface DirectorySource {
  id: number;
  name: string;
  logoUrl: string | null;
  kind: SourceKind;
  region: NewsRegion | null;
}

interface Snapshot {
  sources: Map<number, DirectorySource>;
  fieldTags: Map<Field, number[]>;
}

@Injectable()
export class DirectoryService {
  private cache: { at: number; value: Promise<Snapshot> } | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async fieldTagIds(field: Field): Promise<number[]> {
    return (await this.snapshot()).fieldTags.get(field) ?? [];
  }

  async sourcesOf(kind: SourceKind): Promise<DirectorySource[]> {
    return [...(await this.snapshot()).sources.values()].filter((s) => s.kind === kind);
  }

  async keepSourcesOf(kind: SourceKind, ids: number[]): Promise<number[]> {
    const { sources } = await this.snapshot();
    return ids.filter((id) => sources.get(id)?.kind === kind);
  }

  invalidate(): void {
    this.cache = null;
  }

  private snapshot(now = Date.now()): Promise<Snapshot> {
    if (!this.cache || now - this.cache.at > TTL_MS) {
      const value = this.load().catch((error) => {
        if (this.cache?.value === value) this.cache = null;
        throw error;
      });
      this.cache = { at: now, value };
    }
    return this.cache.value;
  }

  private async load(): Promise<Snapshot> {
    const [sources, tags] = await Promise.all([
      this.dataSource.query('SELECT id, name, logo_url, kind, region FROM sources ORDER BY name, id') as Promise<
        { id: number | string; name: string; logo_url: string | null; kind: SourceKind; region: NewsRegion | null }[]
      >,
      this.dataSource.query('SELECT id, category FROM tags WHERE category IS NOT NULL') as Promise<
        { id: number | string; category: string | null }[]
      >,
    ]);
    return {
      sources: new Map(
        sources.map((s) => [
          Number(s.id),
          { id: Number(s.id), name: s.name, logoUrl: s.logo_url, kind: s.kind, region: s.region },
        ]),
      ),
      fieldTags: groupTagsByField(tags.map((t) => ({ id: Number(t.id), category: t.category }))),
    };
  }
}
