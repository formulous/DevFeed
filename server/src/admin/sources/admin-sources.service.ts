import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { duplicateKeyName } from '../../common/database/mysql-errors';
import { Errors } from '../../common/errors/app.exception';
import { addDays } from '../../common/time/time';
import { CrawlService } from '../../crawl/crawl.service';
import { FeedValidatorService } from '../../crawl/feed-validator.service';
import { PostIngestService } from '../../crawl/post-ingest.service';
import { TagDictionaryService } from '../../crawl/tag-dictionary.service';
import type { NewsRegion, SourceKind, SourceStatus } from '../../entities/source.entity';
import { splitCategories } from '../../ingest/categories';
import type { ContentKind } from '../../ingest/item-normalizer';
import { normalizeFeedUrl } from '../../ingest/url-normalizer';
import { CreateSourceDto, UpdateSourceDto } from '../dto/source.dto';

interface SourceRow {
  id: number | string;
  name: string;
  logo_url: string | null;
  source_type: 'COMPANY' | 'PERSONAL';
  kind: SourceKind;
  region: NewsRegion | null;
  status: SourceStatus;
  last_success_at: Date | null;
  consecutive_failures: number;
  site_url: string;
  feed_url: string;
  crawl_interval_min: number;
  next_crawl_at: Date;
  last_crawled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  new_post_count_7d: number | string | null;
}

interface CrawlRunRow {
  id: number | string;
  trigger_type: 'SCHEDULED' | 'MANUAL';
  result: 'RUNNING' | 'SUCCESS' | 'NOT_MODIFIED' | 'FAILURE';
  started_at: Date;
  finished_at: Date | null;
  attempt_count: number;
  http_status: number | null;
  fetched_count: number;
  new_post_count: number;
  updated_post_count: number;
  error_message: string | null;
}

const SOURCE_COLUMNS = `s.id, s.name, s.logo_url, s.source_type, s.kind, s.region, s.status, s.last_success_at,
  s.consecutive_failures, s.site_url, s.feed_url, s.crawl_interval_min, s.next_crawl_at,
  s.last_crawled_at, s.created_at, s.updated_at,
  (SELECT COALESCE(SUM(r.new_post_count), 0) FROM crawl_runs r
    WHERE r.source_id = s.id AND r.started_at >= ?) AS new_post_count_7d`;

const REINDEX_CHUNK = 500;

function toListItem(row: SourceRow) {
  return {
    id: Number(row.id),
    name: row.name,
    logoUrl: row.logo_url,
    type: row.source_type,
    kind: row.kind,
    region: row.region,
    status: row.status,
    lastSuccessAt: row.last_success_at,
    newPostCount7d: Number(row.new_post_count_7d ?? 0),
    consecutiveFailures: row.consecutive_failures,
  };
}

function toDetail(row: SourceRow) {
  return {
    ...toListItem(row),
    siteUrl: row.site_url,
    feedUrl: row.feed_url,
    crawlIntervalMin: row.crawl_interval_min,
    nextCrawlAt: row.next_crawl_at,
    lastCrawledAt: row.last_crawled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCrawlRun(row: CrawlRunRow) {
  return {
    id: Number(row.id),
    triggerType: row.trigger_type,
    result: row.result,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.finished_at ? row.finished_at.getTime() - row.started_at.getTime() : null,
    attemptCount: row.attempt_count,
    httpStatus: row.http_status,
    fetchedCount: row.fetched_count,
    newPostCount: row.new_post_count,
    updatedPostCount: row.updated_post_count,
    errorMessage: row.error_message,
  };
}

@Injectable()
export class AdminSourcesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly validator: FeedValidatorService,
    private readonly crawl: CrawlService,
    private readonly ingest: PostIngestService,
    private readonly tagDictionary: TagDictionaryService,
  ) {}

  async list(status?: SourceStatus, kind?: SourceKind) {
    const where: string[] = [];
    const params: unknown[] = [addDays(new Date(), -7)];
    if (status) {
      where.push('s.status = ?');
      params.push(status);
    }
    if (kind) {
      where.push('s.kind = ?');
      params.push(kind);
    }
    const rows = (await this.dataSource.query(
      `SELECT ${SOURCE_COLUMNS} FROM sources s ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.name, s.id`,
      params,
    )) as SourceRow[];
    return { items: rows.map(toListItem) };
  }

  async get(id: number) {
    return toDetail(await this.findRow(id));
  }

  private async findRow(id: number): Promise<SourceRow> {
    const [row] = (await this.dataSource.query(`SELECT ${SOURCE_COLUMNS} FROM sources s WHERE s.id = ?`, [
      addDays(new Date(), -7),
      id,
    ])) as SourceRow[];
    if (!row) throw Errors.notFound('소스를 찾을 수 없음');
    return row;
  }

  private canonicalFeedUrl(raw: string): string {
    const url = normalizeFeedUrl(raw);
    if (!url) throw Errors.validation([{ field: 'feedUrl', message: 'http(s) URL이어야 함' }]);
    return url;
  }

  private async isDuplicateFeed(feedUrl: string, exceptId?: number): Promise<boolean> {
    const rows = (await this.dataSource.query(
      'SELECT id FROM sources WHERE feed_url_hash = UNHEX(SHA2(?, 256))',
      [feedUrl],
    )) as { id: number | string }[];
    return rows.some((r) => Number(r.id) !== exceptId);
  }

  private async assertValidFeed(feedUrl: string): Promise<void> {
    const check = await this.validator.check(feedUrl);
    if (!check.ok) throw Errors.sourceFeedInvalid(check.reason);
  }

  async validate(rawFeedUrl: string) {
    const feedUrl = this.canonicalFeedUrl(rawFeedUrl);
    const [check, duplicated] = await Promise.all([
      this.validator.check(feedUrl),
      this.isDuplicateFeed(feedUrl),
    ]);
    if (!check.ok) return { valid: false, duplicated, reason: check.reason };
    return {
      valid: true,
      format: check.feed.format,
      feedTitle: check.feed.title ?? '',
      itemCount: check.feed.items.length,
      sampleTitles: FeedValidatorService.sampleTitles(check.feed),
      duplicated,
    };
  }

  async create(dto: CreateSourceDto) {
    const kind = dto.kind ?? 'BLOG';
    if (kind === 'BLOG' && dto.region !== undefined) {
      throw Errors.validation([{ field: 'region', message: '보안 뉴스만 지정할 수 있음' }]);
    }
    const feedUrl = this.canonicalFeedUrl(dto.feedUrl);
    if (await this.isDuplicateFeed(feedUrl)) throw Errors.sourceFeedDuplicated();
    await this.assertValidFeed(feedUrl);
    try {
      const result = (await this.dataSource.query(
        `INSERT INTO sources
           (name, site_url, feed_url, source_type, kind, region, logo_url, crawl_interval_min, next_crawl_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.name,
          dto.siteUrl,
          feedUrl,
          kind === 'BLOG' ? dto.type : 'COMPANY',
          kind,
          kind === 'BLOG' ? null : dto.region,
          dto.logoUrl ?? null,
          dto.crawlIntervalMin ?? 60,
          new Date(),
        ],
      )) as { insertId: number };
      return this.get(Number(result.insertId));
    } catch (error) {
      if (duplicateKeyName(error) !== null) throw Errors.sourceFeedDuplicated();
      throw error;
    }
  }

  async update(id: number, dto: UpdateSourceDto) {
    const current = await this.findRow(id);
    if (current.kind === 'BLOG' && dto.region !== undefined) {
      throw Errors.validation([{ field: 'region', message: '보안 뉴스만 수정할 수 있음' }]);
    }
    if (current.kind !== 'BLOG' && dto.type !== undefined) {
      throw Errors.validation([{ field: 'type', message: '기술 블로그만 수정할 수 있음' }]);
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      params.push(value);
    };

    if (dto.feedUrl !== undefined) {
      const feedUrl = this.canonicalFeedUrl(dto.feedUrl);
      if (feedUrl !== current.feed_url) {
        if (await this.isDuplicateFeed(feedUrl, id)) throw Errors.sourceFeedDuplicated();
        await this.assertValidFeed(feedUrl);
        set('feed_url', feedUrl);
        set('etag', null);
        set('last_modified', null);
      }
    }
    if (dto.name !== undefined) set('name', dto.name);
    if (dto.siteUrl !== undefined) set('site_url', dto.siteUrl);
    if (dto.type !== undefined) set('source_type', dto.type);
    if (dto.region !== undefined) set('region', dto.region);
    if (dto.logoUrl !== undefined) set('logo_url', dto.logoUrl);
    if (dto.crawlIntervalMin !== undefined) set('crawl_interval_min', dto.crawlIntervalMin);
    if (dto.status === 'INACTIVE' && current.status !== 'INACTIVE') set('status', 'INACTIVE');
    if (dto.status === 'ACTIVE' && current.status !== 'ACTIVE') {
      set('status', 'ACTIVE');
      set('consecutive_failures', 0);
      set('next_crawl_at', new Date());
    }

    if (sets.length) {
      try {
        await this.dataSource.transaction(async (manager) => {
          await manager.query(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
          if (dto.type !== undefined && dto.type !== current.source_type) {
            await manager.query('UPDATE posts SET source_type = ? WHERE source_id = ?', [dto.type, id]);
          }
        });
      } catch (error) {
        if (duplicateKeyName(error) !== null) throw Errors.sourceFeedDuplicated();
        throw error;
      }
    }
    if (dto.name !== undefined && dto.name !== current.name) await this.reindexSource(id, dto.name);
    return this.get(id);
  }

  private async reindexSource(sourceId: number, sourceName: string): Promise<void> {
    const loaded = await this.tagDictionary.get();
    let lastId = 0;
    for (;;) {
      const posts = (await this.dataSource.query(
        `SELECT p.id, p.title, p.summary, p.published_at, p.kind, ps.feed_categories FROM posts p
           LEFT JOIN post_search ps ON ps.post_id = p.id
          WHERE p.source_id = ? AND p.kind = 'BLOG' AND p.id > ? ORDER BY p.id LIMIT ?`,
        [sourceId, lastId, REINDEX_CHUNK],
      )) as {
        id: number | string;
        title: string;
        summary: string | null;
        published_at: Date;
        kind: ContentKind;
        feed_categories: string | null;
      }[];
      if (!posts.length) return;
      await this.dataSource.transaction(async (manager) => {
        for (const post of posts) {
          await this.ingest.reindex(
            manager,
            { id: Number(post.id), title: post.title, summary: post.summary, publishedAt: post.published_at, kind: post.kind },
            sourceName,
            loaded,
            splitCategories(post.feed_categories),
          );
        }
      });
      lastId = Number(posts[posts.length - 1].id);
    }
  }

  async runs(id: number, size = 50) {
    await this.findRow(id);
    const rows = (await this.dataSource.query(
      `SELECT id, trigger_type, result, started_at, finished_at, attempt_count, http_status,
              fetched_count, new_post_count, updated_post_count, error_message
         FROM crawl_runs WHERE source_id = ? ORDER BY started_at DESC, id DESC LIMIT ?`,
      [id, size],
    )) as CrawlRunRow[];
    return { items: rows.map(toCrawlRun) };
  }

  async crawlNow(id: number) {
    const current = await this.findRow(id);
    if (current.status === 'INACTIVE') throw Errors.sourceInactive();
    const started = await this.crawl.start(id, 'MANUAL');
    if (!started) throw Errors.crawlAlreadyRunning();
    return { crawlRunId: started.runId };
  }

  async resume(id: number) {
    const current = await this.findRow(id);
    if (current.status !== 'ERROR') throw Errors.sourceNotInError();
    await this.dataSource.query(
      `UPDATE sources SET status = 'ACTIVE', consecutive_failures = 0, next_crawl_at = ?
        WHERE id = ? AND status = 'ERROR'`,
      [new Date(), id],
    );
    return this.get(id);
  }
}
