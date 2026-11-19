import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

export type SourceType = 'COMPANY' | 'PERSONAL';
export type SourceStatus = 'ACTIVE' | 'ERROR' | 'INACTIVE';

@Entity('sources')
export class Source {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'site_url', type: 'varchar', length: 2048 })
  siteUrl: string;

  @Column({ name: 'feed_url', type: 'varchar', length: 2048 })
  feedUrl: string;

  @Column({ name: 'feed_url_hash', type: 'binary', length: 32, insert: false, update: false, select: false })
  feedUrlHash: Buffer;

  @Column({ name: 'source_type', type: 'enum', enum: ['COMPANY', 'PERSONAL'] })
  sourceType: SourceType;

  @Column({ name: 'logo_url', type: 'varchar', length: 2048, nullable: true })
  logoUrl: string | null;

  @Column({ name: 'crawl_interval_min', type: 'smallint', unsigned: true, default: 60 })
  crawlIntervalMin: number;

  @Column({ type: 'enum', enum: ['ACTIVE', 'ERROR', 'INACTIVE'], default: 'ACTIVE' })
  status: SourceStatus;

  @Column({ name: 'consecutive_failures', type: 'smallint', unsigned: true, default: 0 })
  consecutiveFailures: number;

  @Column({ name: 'next_crawl_at', type: 'datetime', precision: 3 })
  nextCrawlAt: Date;

  @Column({ name: 'crawl_locked_until', type: 'datetime', precision: 3, nullable: true })
  crawlLockedUntil: Date | null;

  @Column({ name: 'last_crawled_at', type: 'datetime', precision: 3, nullable: true })
  lastCrawledAt: Date | null;

  @Column({ name: 'last_success_at', type: 'datetime', precision: 3, nullable: true })
  lastSuccessAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  etag: string | null;

  @Column({ name: 'last_modified', type: 'varchar', length: 64, nullable: true })
  lastModified: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3, insert: false, update: false })
  updatedAt: Date;
}
