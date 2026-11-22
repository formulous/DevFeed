import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

export type CommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';

@Entity('comments')
export class Comment {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ name: 'post_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  postId: number;

  @Column({ name: 'parent_id', type: 'bigint', unsigned: true, nullable: true, transformer: bigintNumber })
  parentId: number | null;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true, transformer: bigintNumber })
  userId: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  body: string | null;

  @Column({ type: 'enum', enum: ['VISIBLE', 'HIDDEN', 'DELETED'], default: 'VISIBLE' })
  status: CommentStatus;

  @Column({ name: 'reply_count', type: 'int', unsigned: true, default: 0 })
  replyCount: number;

  @Column({ name: 'edited_at', type: 'datetime', precision: 3, nullable: true })
  editedAt: Date | null;

  @Column({ name: 'hidden_at', type: 'datetime', precision: 3, nullable: true })
  hiddenAt: Date | null;

  @Column({ name: 'hidden_by', type: 'bigint', unsigned: true, nullable: true, transformer: bigintNumber })
  hiddenBy: number | null;

  @Column({ name: 'hidden_reason', type: 'enum', enum: ['ADMIN', 'REPORTS'], nullable: true })
  hiddenReason: 'ADMIN' | 'REPORTS' | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3, insert: false, update: false })
  updatedAt: Date;
}
