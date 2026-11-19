import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

@Entity('post_tags')
export class PostTag {
  @PrimaryColumn({ name: 'post_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  postId: number;

  @PrimaryColumn({ name: 'tag_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  tagId: number;

  @Column({ name: 'tag_rank', type: 'tinyint', unsigned: true })
  tagRank: number;

  @Column({ name: 'published_at', type: 'datetime', precision: 3 })
  publishedAt: Date;
}
