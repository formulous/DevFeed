import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

@Entity('post_likes')
export class PostLike {
  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  userId: number;

  @PrimaryColumn({ name: 'post_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  postId: number;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;
}
