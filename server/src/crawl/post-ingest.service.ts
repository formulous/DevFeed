import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { withDeadlockRetry } from '../common/database/deadlock-retry';
import type { ContentKind, NormalizedItem } from '../ingest/item-normalizer';
import { joinCategories } from '../ingest/categories';
import { TagMatch } from '../ingest/tagger';
import { toTokenString } from '../ingest/tokenizer';
import { LoadedDictionary, TagDictionaryService } from './tag-dictionary.service';

export type UpsertOutcome = 'new' | 'updated' | 'unchanged';

interface IngestSource {
  id: number;
  name: string;
  sourceType: string;
  kind: ContentKind;
}

export interface IndexablePost {
  id: number;
  title: string;
  summary: string | null;
  publishedAt: Date;
  kind: ContentKind;
}

interface ExistingRow {
  id: number | string;
  title: string;
  summary: string | null;
}

@Injectable()
export class PostIngestService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagDictionary: TagDictionaryService,
  ) {}

  async upsertAll(
    source: IngestSource,
    items: NormalizedItem[],
  ): Promise<{ newCount: number; updatedCount: number }> {
    const loaded = await this.tagDictionary.get();
    let newCount = 0;
    let updatedCount = 0;
    for (const item of items) {
      const outcome = await this.upsert(source, item, loaded);
      if (outcome === 'new') newCount++;
      else if (outcome === 'updated') updatedCount++;
    }
    return { newCount, updatedCount };
  }

  async upsert(source: IngestSource, item: NormalizedItem, loaded: LoadedDictionary): Promise<UpsertOutcome> {
    return withDeadlockRetry(() => this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const existing = await this.findExisting(manager, source.id, item);
      if (existing) {
        if (existing.title === item.title && existing.summary === item.summary) return 'unchanged';
        await manager.query('UPDATE posts SET title = ?, summary = ? WHERE id = ?', [
          item.title,
          item.summary,
          existing.id,
        ]);
        const [row] = (await manager.query('SELECT published_at FROM posts WHERE id = ?', [
          existing.id,
        ])) as { published_at: Date }[];
        await this.reindex(
          manager,
          { id: Number(existing.id), title: item.title, summary: item.summary, publishedAt: row.published_at, kind: source.kind },
          source.name,
          loaded,
          item.categories,
        );
        return 'updated';
      }

      const result = (await manager.query(
        `INSERT INTO posts
           (source_id, source_type, kind, guid, url, title, summary, thumbnail_url, published_at, original_published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [
          source.id,
          source.sourceType,
          source.kind,
          item.guid,
          item.url,
          item.title,
          item.summary,
          item.thumbnailUrl,
          item.publishedAt,
          item.originalPublishedAt,
        ],
      )) as { affectedRows: number; insertId: number };
      if (result.affectedRows !== 1) return 'unchanged';

      await this.reindex(
        manager,
        {
          id: Number(result.insertId),
          title: item.title,
          summary: item.summary,
          publishedAt: item.publishedAt,
          kind: source.kind,
        },
        source.name,
        loaded,
        item.categories,
        true,
      );
      return 'new';
    }));
  }

  async reindex(
    manager: EntityManager,
    post: IndexablePost,
    sourceName: string,
    loaded: LoadedDictionary,
    categories: string[] = [],
    isNew = false,
  ): Promise<TagMatch[]> {
    const matches = loaded.dictionary.extract({ title: post.title, summary: post.summary, categories });
    if (!isNew) await manager.query('DELETE FROM post_tags WHERE post_id = ?', [post.id]);
    if (matches.length) {
      const placeholders = matches.map(() => '(?, ?, ?, ?, ?)').join(', ');
      await manager.query(
        `INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at, kind) VALUES ${placeholders}`,
        matches.flatMap((m) => [post.id, m.tagId, m.rank, post.publishedAt, post.kind]),
      );
    }
    if (post.kind !== 'BLOG') return matches;
    const tagTerms = matches.flatMap((m) => loaded.termsByTag.get(m.tagId) ?? []).join(' ');
    await manager.query(
      `INSERT INTO post_search (post_id, title_tokens, body_tokens, feed_categories) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title_tokens = VALUES(title_tokens), body_tokens = VALUES(body_tokens),
         feed_categories = VALUES(feed_categories)`,
      [post.id, toTokenString(post.title), toTokenString(post.summary, tagTerms, sourceName), joinCategories(categories)],
    );
    return matches;
  }

  private async findExisting(
    manager: EntityManager,
    sourceId: number,
    item: NormalizedItem,
  ): Promise<ExistingRow | null> {
    if (item.guid) {
      const [byGuid] = (await manager.query(
        'SELECT id, title, summary FROM posts WHERE source_id = ? AND guid_hash = UNHEX(SHA2(?, 256))',
        [sourceId, item.guid],
      )) as ExistingRow[];
      if (byGuid) return byGuid;
    }
    const [byUrl] = (await manager.query(
      'SELECT id, title, summary FROM posts WHERE url_hash = UNHEX(SHA2(?, 256))',
      [item.url],
    )) as ExistingRow[];
    return byUrl ?? null;
  }
}
