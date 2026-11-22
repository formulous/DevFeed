import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import { runWithConcurrency } from './concurrency';
import { CrawlService } from './crawl.service';

const BATCH_LIMIT = 100;

@Injectable()
export class CrawlSchedulerService {
  private readonly logger = new Logger(CrawlSchedulerService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly crawl: CrawlService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'crawl-tick' })
  async tick(): Promise<void> {
    if (!this.env.crawl.schedulerEnabled || this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const rows = (await this.dataSource.query(
        `SELECT id FROM sources
          WHERE status IN ('ACTIVE', 'ERROR') AND kind <> 'COMMUNITY' AND next_crawl_at <= ?
          ORDER BY next_crawl_at LIMIT ?`,
        [now, BATCH_LIMIT],
      )) as { id: number | string }[];
      await runWithConcurrency(rows.map((r) => Number(r.id)), this.env.crawl.concurrency, async (id) => {
        try {
          const started = await this.crawl.start(id, 'SCHEDULED');
          await started?.done;
        } catch (error) {
          this.logger.error(`수집 시작 실패 source=${id}: ${(error as Error).message}`);
        }
      });
    } catch (error) {
      this.logger.error(`스케줄러 tick 실패: ${(error as Error).stack}`);
    } finally {
      this.running = false;
    }
  }
}
