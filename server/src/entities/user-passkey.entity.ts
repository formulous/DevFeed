import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';

@Entity('user_passkeys')
export class UserPasskey {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  userId: number;

  @Column({ name: 'credential_id', type: 'varbinary', length: 1023 })
  credentialId: Buffer;

  @Column({ name: 'public_key', type: 'varbinary', length: 2048 })
  publicKey: Buffer;

  @Column({ name: 'sign_count', type: 'int', unsigned: true, default: 0 })
  signCount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transports: string | null;

  @Column({ type: 'binary', length: 16, nullable: true })
  aaguid: Buffer | null;

  @Column({ name: 'backup_eligible', type: 'boolean', default: false })
  backupEligible: boolean;

  @Column({ name: 'backup_state', type: 'boolean', default: false })
  backupState: boolean;

  @Column({ type: 'varchar', length: 40 })
  name: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'datetime', precision: 3, nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3, insert: false, update: false })
  updatedAt: Date;
}
