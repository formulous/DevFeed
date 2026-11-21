import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { duplicateKeyName } from '../common/database/mysql-errors';
import { AppException, Errors } from '../common/errors/app.exception';
import { addDays } from '../common/time/time';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import type { UserRole } from '../entities/user.entity';
import { MeResponse, MeService } from '../me/me.service';
import {
  BCRYPT_ROUNDS,
  classifyRefreshToken,
  generateRefreshToken,
  hashRefreshToken,
  lockRemainingSec,
  newFamilyId,
  nextFailureState,
  REFRESH_TOKEN_DAYS,
} from './auth-policy';

const DUMMY_HASH = bcrypt.hashSync('devfeed-timing-equalizer', 12);

export interface IssuedTokens {
  body: { accessToken: string; expiresIn: number; user: MeResponse };
  refreshToken: string;
}

const invalidCredentials = () =>
  new AppException(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않아요');
const loginLocked = (retryAfterSec: number) =>
  new AppException(423, 'LOGIN_LOCKED', '로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요', { retryAfterSec });
const emailDuplicated = () => new AppException(409, 'EMAIL_DUPLICATED', '이미 가입된 이메일이에요');
const refreshInvalid = () =>
  new AppException(401, 'REFRESH_TOKEN_INVALID', '다시 로그인해 주세요');

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly me: MeService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  get refreshMaxAgeSec(): number {
    return REFRESH_TOKEN_DAYS * 24 * 60 * 60;
  }

  async signup(email: string, password: string, nickname: string, now = new Date()): Promise<IssuedTokens> {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let userId: number;
    try {
      const result = (await this.dataSource.query(
        'INSERT INTO users (email, password_hash, nickname, role, last_login_at) VALUES (?, ?, ?, ?, ?)',
        [email, hash, nickname, 'USER', now],
      )) as { insertId: number };
      userId = Number(result.insertId);
    } catch (error) {
      if (duplicateKeyName(error) !== null) throw emailDuplicated();
      throw error;
    }
    return this.issue(userId, 'USER', newFamilyId(), now);
  }

  async login(email: string, password: string, now = new Date()): Promise<IssuedTokens> {
    const [user] = (await this.dataSource.query(
      'SELECT id, role, password_hash, failed_login_count, locked_until FROM users WHERE email = ?',
      [email],
    )) as {
      id: number | string;
      role: UserRole;
      password_hash: string;
      failed_login_count: number;
      locked_until: Date | null;
    }[];

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw invalidCredentials();
    }
    const userId = Number(user.id);
    const remaining = lockRemainingSec(user.locked_until, now);
    if (remaining > 0) throw loginLocked(remaining);

    if (!(await bcrypt.compare(password, user.password_hash))) {
      const lockedSec = await this.recordFailure(userId, now);
      if (lockedSec > 0) throw loginLocked(lockedSec);
      throw invalidCredentials();
    }

    await this.dataSource.query(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ? WHERE id = ?',
      [now, userId],
    );
    return this.issue(userId, user.role, newFamilyId(), now);
  }

  async loginVerified(userId: number, role: UserRole, now = new Date()): Promise<IssuedTokens> {
    await this.dataSource.query('UPDATE users SET last_login_at = ? WHERE id = ?', [now, userId]);
    return this.issue(userId, role, newFamilyId(), now);
  }

  private async recordFailure(userId: number, now: Date): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const [row] = (await manager.query(
        'SELECT failed_login_count, locked_until FROM users WHERE id = ? FOR UPDATE',
        [userId],
      )) as { failed_login_count: number; locked_until: Date | null }[];
      const alreadyLocked = lockRemainingSec(row.locked_until, now);
      if (alreadyLocked > 0) return alreadyLocked;
      const next = nextFailureState(row.failed_login_count, now);
      await manager.query('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?', [
        next.failedCount,
        next.lockedUntil,
        userId,
      ]);
      return lockRemainingSec(next.lockedUntil, now);
    });
  }

  async refresh(token: string | null, now = new Date()): Promise<IssuedTokens> {
    if (!token) throw refreshInvalid();
    const hash = hashRefreshToken(token);
    const [row] = (await this.dataSource.query(
      `SELECT r.id, r.user_id, r.family_id, r.expires_at, r.revoked_at, u.role
         FROM refresh_tokens r JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = ?`,
      [hash],
    )) as {
      id: number | string;
      user_id: number | string;
      family_id: Buffer;
      expires_at: Date;
      revoked_at: Date | null;
      role: UserRole;
    }[];

    const verdict = classifyRefreshToken(
      row ? { expiresAt: row.expires_at, revokedAt: row.revoked_at } : null,
      now,
    );
    if (verdict === 'reused') {
      await this.revokeFamily(row.family_id, now);
      throw refreshInvalid();
    }
    if (verdict === 'invalid') throw refreshInvalid();

    const claimed = (await this.dataSource.query(
      'UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
      [now, row.id],
    )) as { affectedRows: number };
    if (claimed.affectedRows !== 1) throw refreshInvalid();
    return this.issue(Number(row.user_id), row.role, row.family_id, now);
  }

  async logout(token: string | null, now = new Date()): Promise<void> {
    if (!token) return;
    const [row] = (await this.dataSource.query(
      'SELECT family_id FROM refresh_tokens WHERE token_hash = ?',
      [hashRefreshToken(token)],
    )) as { family_id: Buffer }[];
    if (row) await this.revokeFamily(row.family_id, now);
  }

  private async revokeFamily(familyId: Buffer, now: Date): Promise<void> {
    await this.dataSource.query(
      'UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL',
      [now, familyId],
    );
  }

  private async issue(userId: number, role: UserRole, familyId: Buffer, now: Date): Promise<IssuedTokens> {
    const refreshToken = generateRefreshToken();
    await this.dataSource.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)',
      [userId, hashRefreshToken(refreshToken), familyId, addDays(now, REFRESH_TOKEN_DAYS)],
    );
    const accessToken = await this.jwt.signAsync({ sub: userId, role });
    const user = await this.me.get(userId).catch(() => {
      throw Errors.unauthenticated();
    });
    return { body: { accessToken, expiresIn: this.env.jwt.accessTtlSec, user }, refreshToken };
  }
}
