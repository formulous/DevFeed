import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AuthService, IssuedTokens } from '../auth/auth.service';
import { duplicateKeyName } from '../common/database/mysql-errors';
import { Errors } from '../common/errors/app.exception';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import type { UserRole } from '../entities/user.entity';
import type { ChallengePurpose } from '../entities/webauthn-challenge.entity';
import { defaultPasskeyName } from './passkey-name';
import {
  CHALLENGE_TTL_MS,
  hashChallenge,
  PASSKEY_LIMIT,
  readCredential,
  signCountAccepted,
  SUPPORTED_ALGORITHMS,
} from './passkey-input';

export interface PasskeyView {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface PasskeyRow {
  id: number | string;
  name: string;
  created_at: Date;
  last_used_at: Date | null;
}

const toView = (row: PasskeyRow): PasskeyView => ({
  id: Number(row.id),
  name: row.name,
  createdAt: row.created_at.toISOString(),
  lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
});

const splitTransports = (raw: string | null): string[] | undefined =>
  raw ? raw.split(',').filter(Boolean) : undefined;

@Injectable()
export class PasskeysService {
  private readonly logger = new Logger(PasskeysService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly auth: AuthService,
  ) {}

  private get rp() {
    return this.env.webauthn;
  }

  private async storeChallenge(
    manager: EntityManager,
    purpose: ChallengePurpose,
    userId: number | null,
    now: Date,
  ): Promise<Buffer> {
    const challenge = randomBytes(32);
    await manager.query('DELETE FROM webauthn_challenges WHERE expires_at < ? ORDER BY expires_at LIMIT 100', [now]);
    await manager.query(
      'INSERT INTO webauthn_challenges (challenge_hash, purpose, user_id, expires_at) VALUES (?, ?, ?, ?)',
      [hashChallenge(challenge), purpose, userId, new Date(now.getTime() + CHALLENGE_TTL_MS)],
    );
    return challenge;
  }

  private async consumeChallenge(hash: Buffer, purpose: ChallengePurpose, userId: number | null, now: Date) {
    const result = (await this.dataSource.query(
      `DELETE FROM webauthn_challenges
        WHERE challenge_hash = ? AND purpose = ? AND expires_at > ? AND user_id <=> ?`,
      [hash, purpose, now, userId],
    )) as { affectedRows: number };
    return result.affectedRows === 1;
  }

  async loginOptions(now = new Date()): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const challenge = await this.storeChallenge(this.dataSource.manager, 'LOGIN', null, now);
    return generateAuthenticationOptions({
      rpID: this.rp.rpId,
      challenge: new Uint8Array(challenge),
      timeout: CHALLENGE_TTL_MS,
      userVerification: 'required',
      allowCredentials: [],
    });
  }

  async login(credential: Record<string, unknown>, now = new Date()): Promise<IssuedTokens> {
    const fail = (reason: string) => {
      this.logger.warn(`패스키 로그인 거부: ${reason}`);
      return Errors.passkeyVerificationFailed(401);
    };
    const input = readCredential(credential);
    if (!input) throw fail('형식 오류');
    if (!(await this.consumeChallenge(input.challengeHash, 'LOGIN', null, now))) throw fail('챌린지 없음·만료·재사용');

    const [row] = (await this.dataSource.query(
      `SELECT p.id, p.user_id, p.public_key, p.sign_count, p.transports, u.role, u.webauthn_handle
         FROM user_passkeys p JOIN users u ON u.id = p.user_id
        WHERE p.credential_id = ?`,
      [input.credentialId],
    )) as {
      id: number | string;
      user_id: number | string;
      public_key: Buffer;
      sign_count: number;
      transports: string | null;
      role: UserRole;
      webauthn_handle: Buffer | null;
    }[];
    if (!row) throw Errors.passkeyNotFound();
    if (!input.userHandle || !row.webauthn_handle || !input.userHandle.equals(row.webauthn_handle)) {
      throw fail('userHandle 불일치');
    }

    let newCounter: number;
    try {
      const result = await verifyAuthenticationResponse({
        response: credential as unknown as AuthenticationResponseJSON,
        expectedChallenge: input.challenge,
        expectedOrigin: this.rp.origins,
        expectedRPID: this.rp.rpId,
        credential: {
          id: input.credentialId.toString('base64url'),
          publicKey: new Uint8Array(row.public_key),
          counter: row.sign_count,
          transports: splitTransports(row.transports) as never,
        },
        requireUserVerification: true,
      });
      if (!result.verified) throw new Error('서명 불일치');
      newCounter = result.authenticationInfo.newCounter;
    } catch (error) {
      throw fail((error as Error).message);
    }
    if (!signCountAccepted(row.sign_count, newCounter)) throw fail('서명 횟수 역행');

    const updated = (await this.dataSource.query(
      `UPDATE user_passkeys SET sign_count = ?, last_used_at = ?
        WHERE id = ? AND (? > sign_count OR (? = 0 AND sign_count = 0))`,
      [newCounter, now, row.id, newCounter, newCounter],
    )) as { affectedRows: number };
    if (updated.affectedRows !== 1) throw fail('서명 횟수 역행(동시)');

    return this.auth.loginVerified(Number(row.user_id), row.role, now);
  }

  async registrationOptions(userId: number, now = new Date()): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return this.dataSource.transaction(async (manager) => {
      const [user] = (await manager.query(
        'SELECT email, nickname, webauthn_handle FROM users WHERE id = ? FOR UPDATE',
        [userId],
      )) as { email: string; nickname: string; webauthn_handle: Buffer | null }[];
      if (!user) throw Errors.unauthenticated();
      if (!user.webauthn_handle) {
        await manager.query('UPDATE users SET webauthn_handle = ? WHERE id = ? AND webauthn_handle IS NULL', [
          randomBytes(32),
          userId,
        ]);
      }
      const [{ webauthn_handle: handle }] = (await manager.query(
        'SELECT webauthn_handle FROM users WHERE id = ?',
        [userId],
      )) as { webauthn_handle: Buffer }[];

      const existing = (await manager.query(
        'SELECT credential_id, transports FROM user_passkeys WHERE user_id = ?',
        [userId],
      )) as { credential_id: Buffer; transports: string | null }[];
      if (existing.length >= PASSKEY_LIMIT) throw Errors.passkeyLimitExceeded();

      const challenge = await this.storeChallenge(manager, 'REGISTER', userId, now);
      return generateRegistrationOptions({
        rpName: this.rp.rpName,
        rpID: this.rp.rpId,
        userName: user.email,
        userID: new Uint8Array(handle),
        userDisplayName: user.nickname,
        challenge: new Uint8Array(challenge),
        timeout: CHALLENGE_TTL_MS,
        attestationType: 'none',
        excludeCredentials: existing.map((row) => ({
          id: row.credential_id.toString('base64url'),
          transports: splitTransports(row.transports),
        })),
        authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
        supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
      });
    });
  }

  async register(
    userId: number,
    credential: Record<string, unknown>,
    name: string | undefined,
    userAgent: string | undefined,
    now = new Date(),
  ): Promise<PasskeyView> {
    const fail = (reason: string) => {
      this.logger.warn(`패스키 등록 거부: ${reason}`);
      return Errors.passkeyVerificationFailed(400);
    };
    const input = readCredential(credential);
    if (!input) throw fail('형식 오류');
    if (!(await this.consumeChallenge(input.challengeHash, 'REGISTER', userId, now))) {
      throw fail('챌린지 없음·만료·재사용·다른 회원');
    }

    let info: NonNullable<Awaited<ReturnType<typeof verifyRegistrationResponse>>['registrationInfo']>;
    try {
      const result = await verifyRegistrationResponse({
        response: credential as unknown as RegistrationResponseJSON,
        expectedChallenge: input.challenge,
        expectedOrigin: this.rp.origins,
        expectedRPID: this.rp.rpId,
        requireUserVerification: true,
        supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
      });
      if (!result.verified) throw new Error('검증 실패');
      info = result.registrationInfo;
    } catch (error) {
      throw fail((error as Error).message);
    }
    const credentialId = Buffer.from(info.credential.id, 'base64url');
    if (!credentialId.equals(input.credentialId)) throw fail('credential id 불일치');

    const transports = (
      (credential.response as { transports?: unknown }).transports as unknown[] | undefined
    )?.filter((value): value is string => typeof value === 'string');
    const aaguid = Buffer.from(info.aaguid.replace(/-/g, ''), 'hex');

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
      const [{ count }] = (await manager.query(
        'SELECT COUNT(*) AS count FROM user_passkeys WHERE user_id = ?',
        [userId],
      )) as { count: number | string }[];
      if (Number(count) >= PASSKEY_LIMIT) throw Errors.passkeyLimitExceeded();
      try {
        const result = (await manager.query(
          `INSERT INTO user_passkeys
             (user_id, credential_id, public_key, sign_count, transports, aaguid, backup_eligible, backup_state, name, last_used_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            userId,
            credentialId,
            Buffer.from(info.credential.publicKey),
            info.credential.counter,
            transports?.length ? transports.join(',').slice(0, 255) : null,
            aaguid.length === 16 ? aaguid : null,
            info.credentialDeviceType === 'multiDevice',
            info.credentialBackedUp,
            name ?? defaultPasskeyName(userAgent, Number(count)),
          ],
        )) as { insertId: number };
        return this.findOwn(manager, userId, Number(result.insertId));
      } catch (error) {
        if (duplicateKeyName(error) !== null) throw Errors.passkeyAlreadyRegistered();
        throw error;
      }
    });
  }

  private async findOwn(manager: EntityManager, userId: number, passkeyId: number): Promise<PasskeyView> {
    const [row] = (await manager.query(
      'SELECT id, name, created_at, last_used_at FROM user_passkeys WHERE id = ? AND user_id = ?',
      [passkeyId, userId],
    )) as PasskeyRow[];
    if (!row) throw Errors.notFound('패스키를 찾을 수 없어요');
    return toView(row);
  }

  async list(userId: number): Promise<{ items: PasskeyView[] }> {
    const rows = (await this.dataSource.query(
      `SELECT id, name, created_at, last_used_at FROM user_passkeys
        WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      [userId],
    )) as PasskeyRow[];
    return { items: rows.map(toView) };
  }

  async rename(userId: number, passkeyId: number, name: string): Promise<PasskeyView> {
    await this.dataSource.query('UPDATE user_passkeys SET name = ? WHERE id = ? AND user_id = ?', [
      name,
      passkeyId,
      userId,
    ]);
    return this.findOwn(this.dataSource.manager, userId, passkeyId);
  }

  async remove(userId: number, passkeyId: number): Promise<void> {
    const result = (await this.dataSource.query('DELETE FROM user_passkeys WHERE id = ? AND user_id = ?', [
      passkeyId,
      userId,
    ])) as { affectedRows: number };
    if (result.affectedRows !== 1) throw Errors.notFound('패스키를 찾을 수 없어요');
  }
}
