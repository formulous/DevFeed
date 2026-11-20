import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { duplicateKeyName } from '../../common/database/mysql-errors';
import { Errors } from '../../common/errors/app.exception';
import { PostIngestService } from '../../crawl/post-ingest.service';
import { TagDictionaryService } from '../../crawl/tag-dictionary.service';
import { splitCategories } from '../../ingest/categories';
import type { ContentKind } from '../../ingest/item-normalizer';
import { CreateTagDto, UpdateTagDto } from '../dto/tag.dto';
import { JobsService } from '../jobs/jobs.service';
import { TagCountsService } from '../../catalog/tag-counts.service';

interface TagRow {
  id: number | string;
  name: string;
  slug: string;
  category: string | null;
  synonyms: string | null;
}

const SYNONYM_SEPARATOR = '\u001f';
const RETAG_CHUNK = 500;

@Injectable()
export class AdminTagsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly counts: TagCountsService,
    private readonly dictionary: TagDictionaryService,
    private readonly ingest: PostIngestService,
    private readonly jobs: JobsService,
  ) {}

  async list(q?: string) {
    const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const rows = (await this.dataSource.query(
      `SELECT t.id, t.name, t.slug, t.category,
              GROUP_CONCAT(s.synonym ORDER BY s.id SEPARATOR '${SYNONYM_SEPARATOR}') AS synonyms
         FROM tags t LEFT JOIN tag_synonyms s ON s.tag_id = t.id
        ${like ? 'WHERE t.name LIKE ? OR EXISTS (SELECT 1 FROM tag_synonyms x WHERE x.tag_id = t.id AND x.synonym LIKE ?)' : ''}
        GROUP BY t.id ORDER BY t.name`,
      like ? [like, like] : [],
    )) as TagRow[];
    const counts = await this.counts.get();
    return { items: rows.map((row) => this.toAdminTag(row, counts)) };
  }

  private toAdminTag(row: TagRow, counts: Map<number, number>) {
    const id = Number(row.id);
    return {
      id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      synonyms: row.synonyms ? row.synonyms.split(SYNONYM_SEPARATOR) : [],
      postCount: counts.get(id) ?? 0,
    };
  }

  private async getOne(id: number) {
    const [row] = (await this.dataSource.query(
      `SELECT t.id, t.name, t.slug, t.category,
              GROUP_CONCAT(s.synonym ORDER BY s.id SEPARATOR '${SYNONYM_SEPARATOR}') AS synonyms
         FROM tags t LEFT JOIN tag_synonyms s ON s.tag_id = t.id
        WHERE t.id = ? GROUP BY t.id`,
      [id],
    )) as TagRow[];
    if (!row) throw Errors.notFound('태그를 찾을 수 없음');
    return this.toAdminTag(row, await this.counts.get());
  }

  private uniqueSynonyms(name: string, synonyms: string[]): string[] {
    const seen = new Set([name.toLowerCase()]);
    const result: string[] = [];
    for (const synonym of synonyms) {
      const key = synonym.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(synonym);
    }
    return result;
  }

  private async replaceSynonyms(manager: EntityManager, tagId: number, synonyms: string[]) {
    await manager.query('DELETE FROM tag_synonyms WHERE tag_id = ?', [tagId]);
    for (const synonym of synonyms) {
      try {
        await manager.query('INSERT INTO tag_synonyms (tag_id, synonym) VALUES (?, ?)', [tagId, synonym]);
      } catch (error) {
        if (duplicateKeyName(error) !== null) throw Errors.synonymDuplicated(synonym);
        throw error;
      }
    }
  }

  private mapDuplicate(error: unknown): never {
    const key = duplicateKeyName(error);
    if (key === null) throw error;
    if (key.includes('synonym')) throw Errors.synonymDuplicated();
    throw Errors.tagDuplicated();
  }

  async create(dto: CreateTagDto) {
    let id = 0;
    try {
      await this.dataSource.transaction(async (manager) => {
        const result = (await manager.query('INSERT INTO tags (name, slug, category) VALUES (?, ?, ?)', [
          dto.name,
          dto.slug,
          dto.category ?? null,
        ])) as { insertId: number };
        id = Number(result.insertId);
        await this.replaceSynonyms(manager, id, this.uniqueSynonyms(dto.name, dto.synonyms ?? []));
      });
    } catch (error) {
      this.mapDuplicate(error);
    }
    this.dictionary.invalidate();
    return this.getOne(id);
  }

  async update(id: number, dto: UpdateTagDto) {
    const current = await this.getOne(id);
    try {
      await this.dataSource.transaction(async (manager) => {
        const sets: string[] = [];
        const params: unknown[] = [];
        if (dto.name !== undefined) (sets.push('name = ?'), params.push(dto.name));
        if (dto.slug !== undefined) (sets.push('slug = ?'), params.push(dto.slug));
        if (dto.category !== undefined) (sets.push('category = ?'), params.push(dto.category));
        if (sets.length) await manager.query(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        if (dto.synonyms !== undefined) {
          await this.replaceSynonyms(manager, id, this.uniqueSynonyms(dto.name ?? current.name, dto.synonyms));
        }
      });
    } catch (error) {
      this.mapDuplicate(error);
    }
    this.dictionary.invalidate();
    return this.getOne(id);
  }

  startRetag() {
    const { job } = this.jobs.start('RETAG', async (context) => {
      this.dictionary.invalidate();
      const loaded = await this.dictionary.get();
      const [{ total }] = (await this.dataSource.query('SELECT COUNT(*) AS total FROM posts')) as {
        total: number | string;
      }[];
      context.setTotal(Number(total));
      let lastId = 0;
      for (;;) {
        const posts = (await this.dataSource.query(
          `SELECT p.id, p.title, p.summary, p.published_at, p.kind, s.name AS source_name, ps.feed_categories
             FROM posts p JOIN sources s ON s.id = p.source_id
             LEFT JOIN post_search ps ON ps.post_id = p.id
            WHERE p.id > ? ORDER BY p.id LIMIT ?`,
          [lastId, RETAG_CHUNK],
        )) as {
          id: number | string;
          title: string;
          summary: string | null;
          published_at: Date;
          kind: ContentKind;
          source_name: string;
          feed_categories: string | null;
        }[];
        if (!posts.length) break;
        await this.dataSource.transaction(async (manager) => {
          for (const post of posts) {
            await this.ingest.reindex(
              manager,
              {
                id: Number(post.id),
                title: post.title,
                summary: post.summary,
                publishedAt: post.published_at,
                kind: post.kind,
              },
              post.source_name,
              loaded,
              splitCategories(post.feed_categories),
            );
          }
        });
        context.advance(posts.length);
        lastId = Number(posts[posts.length - 1].id);
      }
      this.counts.invalidate();
    });
    return { jobId: job.id };
  }
}
