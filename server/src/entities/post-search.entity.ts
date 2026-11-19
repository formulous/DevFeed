import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

@Entity('post_search')
export class PostSearch {
  @PrimaryColumn({ name: 'post_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  postId: number;

  @Column({ name: 'title_tokens', type: 'text' })
  titleTokens: string;

  @Column({ name: 'body_tokens', type: 'text' })
  bodyTokens: string;

  @Column({ name: 'feed_categories', type: 'varchar', length: 500, nullable: true })
  feedCategories: string | null;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3, insert: false, update: false })
  updatedAt: Date;
}
