import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

export type ChallengePurpose = 'REGISTER' | 'LOGIN';

@Entity('webauthn_challenges')
export class WebauthnChallenge {
  @PrimaryColumn({ name: 'challenge_hash', type: 'binary', length: 32 })
  challengeHash: Buffer;

  @Column({ type: 'enum', enum: ['REGISTER', 'LOGIN'] })
  purpose: ChallengePurpose;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true, transformer: bigintNumber })
  userId: number | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;
}
