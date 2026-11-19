import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TagDefinition, TagDictionary } from '../ingest/tagger';

export interface LoadedDictionary {
  dictionary: TagDictionary;
  termsByTag: Map<number, string[]>;
}

@Injectable()
export class TagDictionaryService {
  private cached: Promise<LoadedDictionary> | null = null;

  constructor(private readonly dataSource: DataSource) {}

  get(): Promise<LoadedDictionary> {
    if (!this.cached) {
      this.cached = this.load().catch((error) => {
        this.cached = null;
        throw error;
      });
    }
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
  }

  private async load(): Promise<LoadedDictionary> {
    const rows = (await this.dataSource.query(
      `SELECT t.id, t.name, s.synonym
         FROM tags t LEFT JOIN tag_synonyms s ON s.tag_id = t.id
        ORDER BY t.id`,
    )) as { id: number | string; name: string; synonym: string | null }[];
    const byId = new Map<number, TagDefinition>();
    for (const row of rows) {
      const id = Number(row.id);
      const tag = byId.get(id) ?? { id, name: row.name, synonyms: [] };
      if (row.synonym) tag.synonyms.push(row.synonym);
      byId.set(id, tag);
    }
    const tags = [...byId.values()];
    return {
      dictionary: new TagDictionary(tags),
      termsByTag: new Map(tags.map((t) => [t.id, [t.name, ...t.synonyms]])),
    };
  }
}
