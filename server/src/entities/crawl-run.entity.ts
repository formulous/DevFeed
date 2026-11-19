import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

export type CrawlTrigger = 'SCHEDULED' | 'MANUAL';
export type CrawlResult = 'RUNNING' | 'SUCCESS' | 'NOT_MODIFIED' | 'FAILURE';

@Entity('crawl_runs')
export class CrawlRun {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ name: 'source_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  sourceId: number;

  @Column({ name: 'trigger_type', type: 'enum', enum: ['SCHEDULED', 'MANUAL'] })
  triggerType: CrawlTrigger;

  @Column({ type: 'enum', enum: ['RUNNING', 'SUCCESS', 'NOT_MODIFIED', 'FAILURE'], default: 'RUNNING' })
  result: CrawlResult;

  @Column({ name: 'started_at', type: 'datetime', precision: 3 })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'attempt_count', type: 'tinyint', unsigned: true, default: 1 })
  attemptCount: number;

  @Column({ name: 'http_status', type: 'smallint', unsigned: true, nullable: true })
  httpStatus: number | null;

  @Column({ name: 'fetched_count', type: 'smallint', unsigned: true, default: 0 })
  fetchedCount: number;

  @Column({ name: 'new_post_count', type: 'smallint', unsigned: true, default: 0 })
  newPostCount: number;

  @Column({ name: 'updated_post_count', type: 'smallint', unsigned: true, default: 0 })
  updatedPostCount: number;

  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true })
  errorMessage: string | null;
}
