import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { addDays } from '../common/time/time';
import { impressionRetentionThreshold, statsRange } from '../recommendations/recommendation-stats';

export const CRAWL_RUN_RETENTION_DAYS = 90;
export const READ_HISTORY_RETENTION_DAYS = 365;
export const VIEW_GUARD_RETENTION_HOURS = 24;
const DELETE_CHUNK = 1000;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron('0 0 4 * * *', { name: 'daily-maintenance', timeZone: 'Asia/Seoul' })
  async daily(): Promise<void> {
    try {
      const now = new Date();
      const runs = await this.deleteOldCrawlRuns(now);
      const reads = await this.deleteInChunks(
        'DELETE FROM read_histories WHERE last_read_at < ? LIMIT ?',
        addDays(now, -READ_HISTORY_RETENTION_DAYS),
      );
      this.logger.log(`crawl_runs ${runs}건, read_histories ${reads}건 삭제`);
      const impressions = await this.recommendationStats(now);
      this.logger.log(`추천 일별 집계 완료, 노출 원본 ${impressions}건 삭제`);
    } catch (error) {
      this.logger.error(`일일 정리 실패: ${(error as Error).stack}`);
    }
  }

  @Cron('0 5 * * * *', { name: 'hourly-maintenance' })
  async hourly(): Promise<void> {
    try {
      const threshold = new Date(Date.now() - VIEW_GUARD_RETENTION_HOURS * 60 * 60 * 1000);
      await this.deleteInChunks('DELETE FROM post_view_guards WHERE counted_at < ? LIMIT ?', threshold);
    } catch (error) {
      this.logger.error(`시간별 정리 실패: ${(error as Error).stack}`);
    }
  }

  async recommendationStats(now: Date): Promise<number> {
    const { from, to } = statsRange(now);
    await this.dataSource.query(
      `INSERT INTO recommendation_daily_stats (stat_date, algorithm, impression_count, click_count, request_count)
       SELECT DATE(shown_at), algorithm, COUNT(*), COUNT(clicked_at), COUNT(DISTINCT request_id)
         FROM recommendation_impressions
        WHERE shown_at >= ? AND shown_at < ?
        GROUP BY DATE(shown_at), algorithm
       ON DUPLICATE KEY UPDATE impression_count = VALUES(impression_count),
         click_count = VALUES(click_count), request_count = VALUES(request_count)`,
      [from, to],
    );
    return this.deleteInChunks(
      'DELETE FROM recommendation_impressions WHERE shown_at < ? LIMIT ?',
      impressionRetentionThreshold(now),
    );
  }

  deleteOldCrawlRuns(now: Date): Promise<number> {
    return this.deleteInChunks(
      'DELETE FROM crawl_runs WHERE started_at < ? LIMIT ?',
      addDays(now, -CRAWL_RUN_RETENTION_DAYS),
    );
  }

  async deleteInChunks(sql: string, threshold: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const result = (await this.dataSource.query(sql, [threshold, DELETE_CHUNK])) as { affectedRows: number };
      total += result.affectedRows;
      if (result.affectedRows < DELETE_CHUNK) return total;
    }
  }
}
