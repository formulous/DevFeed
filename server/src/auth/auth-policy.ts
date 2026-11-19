import { createHash, randomBytes } from 'node:crypto';

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 10;
export const REFRESH_TOKEN_DAYS = 14;
export const REFRESH_REUSE_GRACE_MS = 30_000;
export const REFRESH_COOKIE = 'df_rt';
export const REFRESH_COOKIE_PATH = '/api/auth';
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7e]{8,64}$/;
export const BCRYPT_ROUNDS = 12;

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function newFamilyId(): Buffer {
  return randomBytes(16);
}

export function lockRemainingSec(lockedUntil: Date | null, now: Date): number {
  if (!lockedUntil) return 0;
  const remaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function nextFailureState(
  failedCount: number,
  now: Date,
): { failedCount: number; lockedUntil: Date | null } {
  const next = failedCount + 1;
  if (next >= MAX_LOGIN_FAILURES) {
    return { failedCount: 0, lockedUntil: new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60_000) };
  }
  return { failedCount: next, lockedUntil: null };
}

export type RefreshVerdict = 'valid' | 'invalid' | 'reused';

export function classifyRefreshToken(
  row: { expiresAt: Date; revokedAt: Date | null } | null,
  now: Date,
): RefreshVerdict {
  if (!row) return 'invalid';
  if (row.revokedAt) {
    return now.getTime() - row.revokedAt.getTime() > REFRESH_REUSE_GRACE_MS ? 'reused' : 'invalid';
  }
  if (row.expiresAt.getTime() <= now.getTime()) return 'invalid';
  return 'valid';
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function refreshCookie(token: string | null, secure: boolean, maxAgeSec: number): string {
  const attributes = [
    `${REFRESH_COOKIE}=${token ? encodeURIComponent(token) : ''}`,
    `Path=${REFRESH_COOKIE_PATH}`,
    `Max-Age=${token ? maxAgeSec : 0}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}
