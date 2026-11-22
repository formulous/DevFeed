import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

export type ScoreEventKind = 'READ' | 'LIKE' | 'COMMENT' | 'ARCHIVE';

@Entity('score_events')
export class ScoreEvent {
  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  userId: number;

  @PrimaryColumn({ type: 'enum', enum: ['READ', 'LIKE', 'COMMENT', 'ARCHIVE'] })
  kind: ScoreEventKind;

  @PrimaryColumn({ name: 'ref_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  refId: number;

  @Column({ type: 'int', unsigned: true })
  points: number;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true })
  revokedAt: Date | null;
}
