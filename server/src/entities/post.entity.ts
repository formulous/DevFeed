import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';
import type { SourceKind, SourceType } from './source.entity';

@Entity('posts')
export class Post {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ name: 'source_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  sourceId: number;

  @Column({ name: 'source_type', type: 'enum', enum: ['COMPANY', 'PERSONAL'] })
  sourceType: SourceType;

  @Column({ type: 'enum', enum: ['BLOG', 'SECURITY_NEWS'], default: 'BLOG' })
  kind: SourceKind;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  guid: string | null;

  @Column({ name: 'guid_hash', type: 'binary', length: 32, nullable: true, insert: false, update: false, select: false })
  guidHash: Buffer | null;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ name: 'url_hash', type: 'binary', length: 32, insert: false, update: false, select: false })
  urlHash: Buffer;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  summary: string | null;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 2048, nullable: true })
  thumbnailUrl: string | null;

  @Column({ name: 'published_at', type: 'datetime', precision: 3 })
  publishedAt: Date;

  @Column({ name: 'original_published_at', type: 'datetime', precision: 3, nullable: true })
  originalPublishedAt: Date | null;

  @Column({ name: 'view_count', type: 'int', unsigned: true, default: 0 })
  viewCount: number;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3, insert: false, update: false })
  updatedAt: Date;
}
