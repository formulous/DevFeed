import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { addMinutes } from '../common/time/time';
import { CrawlTrigger } from '../entities/crawl-run.entity';
import { ERROR_THRESHOLD, nextIntervalMinutes } from '../ingest/backoff';
import { FeedFetchError, fetchFeed } from '../ingest/feed-fetcher';
import { FeedParseError, parseFeed } from '../ingest/feed-parser';
import { ContentKind, NormalizedItem, normalizeItem } from '../ingest/item-normalizer';
import { PostIngestService } from './post-ingest.service';

export const CRAWL_LOCK_MINUTES = 5;
const ERROR_MESSAGE_MAX = 1000;

interface SourceRow {
  id: number;
  name: string;
  feed_url: string;
  site_url: string;
  source_type: string;
  kind: ContentKind;
  status: string;
  crawl_interval_min: number;
  consecutive_failures: number;
  etag: string | null;
  last_modified: string | null;
}

export interface StartedCrawl {
  runId: number;
  done: Promise<void>;
}

type Outcome =
  | {
      result: 'SUCCESS' | 'NOT_MODIFIED';
      attempts: number;
      httpStatus: number;
      fetched: number;
      newCount: number;
      updatedCount: number;
      etag?: string | null;
      lastModified?: string | null;
    }
  | { result: 'FAILURE'; attempts: number; httpStatus: number | null; message: string; fetched?: number };

@Injectable()
export class CrawlService {
  private readonly logger = new Logger(CrawlService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ingest: PostIngestService,
  ) {}

  async start(sourceId: number, trigger: CrawlTrigger, now = new Date()): Promise<StartedCrawl | null> {
    const lock = (await this.dataSource.query(
      `UPDATE sources SET crawl_locked_until = ?
        WHERE id = ? AND status <> 'INACTIVE'
          AND (crawl_locked_until IS NULL OR crawl_locked_until < ?)`,
      [addMinutes(now, CRAWL_LOCK_MINUTES), sourceId, now],
    )) as { affectedRows: number };
    if (lock.affectedRows !== 1) return null;

    try {
      await this.dataSource.query(
        `UPDATE crawl_runs SET result = 'FAILURE', finished_at = ?, error_message = 'interrupted'
          WHERE source_id = ? AND result = 'RUNNING'`,
        [now, sourceId],
      );
      const inserted = (await this.dataSource.query(
        `INSERT INTO crawl_runs (source_id, trigger_type, result, started_at) VALUES (?, ?, 'RUNNING', ?)`,
        [sourceId, trigger, now],
      )) as { insertId: number };
      const runId = Number(inserted.insertId);
      const done = this.execute(sourceId, runId, now).catch((error) => {
        this.logger.error(`수집 처리 오류 source=${sourceId} run=${runId}: ${(error as Error).stack}`);
      });
      return { runId, done };
    } catch (error) {
      await this.dataSource
        .query('UPDATE sources SET crawl_locked_until = NULL WHERE id = ?', [sourceId])
        .catch(() => undefined);
      throw error;
    }
  }

  private async loadSource(sourceId: number): Promise<SourceRow> {
    const [row] = (await this.dataSource.query(
      `SELECT id, name, feed_url, site_url, source_type, kind, status, crawl_interval_min,
              consecutive_failures, etag, last_modified
         FROM sources WHERE id = ?`,
      [sourceId],
    )) as SourceRow[];
    return { ...row, id: Number(row.id) };
  }

  private async execute(sourceId: number, runId: number, startedAt: Date): Promise<void> {
    const source = await this.loadSource(sourceId);
    const outcome = await this.crawl(source, startedAt);
    await this.finish(source, runId, startedAt, outcome);
  }

  private async crawl(source: SourceRow, now: Date): Promise<Outcome> {
    let attempts = 1;
    let httpStatus: number | null = null;
    let fetched = 0;
    try {
      const response = await fetchFeed(source.feed_url, {
        etag: source.etag,
        lastModified: source.last_modified,
      });
      attempts = response.attempts;
      httpStatus = response.status;
      if (response.kind === 'not_modified') {
        return { result: 'NOT_MODIFIED', attempts, httpStatus: 304, fetched: 0, newCount: 0, updatedCount: 0 };
      }
      const feed = parseFeed(response.body);
      fetched = feed.items.length;
      const baseUrl = feed.siteUrl ?? source.site_url ?? source.feed_url;
      const items = feed.items
        .map((item) => normalizeItem(item, { baseUrl, now, kind: source.kind }))
        .filter((item): item is NormalizedItem => item !== null);
      const { newCount, updatedCount } = await this.ingest.upsertAll(
        { id: source.id, name: source.name, sourceType: source.source_type, kind: source.kind },
        items,
      );
      return {
        result: 'SUCCESS',
        attempts,
        httpStatus: response.status,
        fetched,
        newCount,
        updatedCount,
        etag: response.etag,
        lastModified: response.lastModified,
      };
    } catch (error) {
      if (error instanceof FeedFetchError) {
        return { result: 'FAILURE', attempts: error.attempts, httpStatus: error.status, message: error.message };
      }
      if (error instanceof FeedParseError) {
        return { result: 'FAILURE', attempts, httpStatus, message: error.message, fetched };
      }
      this.logger.error(`수집 중 예외 source=${source.id}: ${(error as Error).stack}`);
      return { result: 'FAILURE', attempts, httpStatus, message: (error as Error).message || 'internal error', fetched };
    }
  }

  private async finish(source: SourceRow, runId: number, startedAt: Date, outcome: Outcome): Promise<void> {
    const finishedAt = new Date();
    if (outcome.result === 'FAILURE') {
      await this.dataSource.query(
        `UPDATE crawl_runs SET result = 'FAILURE', finished_at = ?, attempt_count = ?, http_status = ?,
                fetched_count = ?, error_message = ? WHERE id = ?`,
        [
          finishedAt,
          Math.min(outcome.attempts, 255),
          outcome.httpStatus,
          outcome.fetched ?? 0,
          outcome.message.slice(0, ERROR_MESSAGE_MAX),
          runId,
        ],
      );
      const failures = source.consecutive_failures + 1;
      const interval = nextIntervalMinutes(source.crawl_interval_min, failures);
      await this.dataSource.query(
        `UPDATE sources
            SET consecutive_failures = ?,
                status = IF(status <> 'INACTIVE' AND ? >= ?, 'ERROR', status),
                last_crawled_at = ?, next_crawl_at = ?, crawl_locked_until = NULL
          WHERE id = ?`,
        [Math.min(failures, 65535), failures, ERROR_THRESHOLD, finishedAt, addMinutes(startedAt, interval), source.id],
      );
      return;
    }

    await this.dataSource.query(
      `UPDATE crawl_runs SET result = ?, finished_at = ?, attempt_count = ?, http_status = ?,
              fetched_count = ?, new_post_count = ?, updated_post_count = ? WHERE id = ?`,
      [
        outcome.result,
        finishedAt,
        Math.min(outcome.attempts, 255),
        outcome.httpStatus,
        Math.min(outcome.fetched, 65535),
        Math.min(outcome.newCount, 65535),
        Math.min(outcome.updatedCount, 65535),
        runId,
      ],
    );
    const validators =
      outcome.result === 'SUCCESS'
        ? [outcome.etag?.slice(0, 255) ?? null, outcome.lastModified?.slice(0, 64) ?? null]
        : [source.etag, source.last_modified];
    await this.dataSource.query(
      `UPDATE sources
          SET consecutive_failures = 0,
              status = IF(status = 'ERROR', 'ACTIVE', status),
              etag = ?, last_modified = ?,
              last_crawled_at = ?, last_success_at = ?, next_crawl_at = ?, crawl_locked_until = NULL
        WHERE id = ?`,
      [...validators, finishedAt, finishedAt, addMinutes(startedAt, source.crawl_interval_min), source.id],
    );
  }
}
