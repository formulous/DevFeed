import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

export type UserRole = 'USER' | 'ADMIN';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 30 })
  nickname: string;

  @Column({ name: 'webauthn_handle', type: 'binary', length: 32, nullable: true, select: false })
  webauthnHandle: Buffer | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  score: number;

  @Column({ type: 'enum', enum: ['USER', 'ADMIN'], default: 'USER' })
  role: UserRole;

  @Column({ name: 'failed_login_count', type: 'tinyint', unsigned: true, default: 0 })
  failedLoginCount: number;

  @Column({ name: 'locked_until', type: 'datetime', precision: 3, nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'onboarding_completed_at', type: 'datetime', precision: 3, nullable: true })
  onboardingCompletedAt: Date | null;

  @Column({ name: 'last_login_at', type: 'datetime', precision: 3, nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3, insert: false, update: false })
  updatedAt: Date;
}
