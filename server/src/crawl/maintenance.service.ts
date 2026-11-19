import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { addDays } from '../common/time/time';

export const CRAWL_RUN_RETENTION_DAYS = 90;
const DELETE_CHUNK = 1000;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron('0 0 4 * * *', { name: 'daily-maintenance', timeZone: 'Asia/Seoul' })
  async daily(): Promise<void> {
    try {
      const deleted = await this.deleteOldCrawlRuns(new Date());
      this.logger.log(`crawl_runs ${deleted}건 삭제`);
    } catch (error) {
      this.logger.error(`일일 정리 실패: ${(error as Error).stack}`);
    }
  }

  async deleteOldCrawlRuns(now: Date): Promise<number> {
    const threshold = addDays(now, -CRAWL_RUN_RETENTION_DAYS);
    let total = 0;
    for (;;) {
      const result = (await this.dataSource.query(
        'DELETE FROM crawl_runs WHERE started_at < ? LIMIT ?',
        [threshold, DELETE_CHUNK],
      )) as { affectedRows: number };
      total += result.affectedRows;
      if (result.affectedRows < DELETE_CHUNK) return total;
    }
  }
}
