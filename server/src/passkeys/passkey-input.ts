import { createHash } from 'node:crypto';

export const CHALLENGE_TTL_MS = 5 * 60_000;
export const PASSKEY_LIMIT = 10;
export const SUPPORTED_ALGORITHMS = [-7, -8, -257];

export interface CredentialInput {
  credentialId: Buffer;
  challenge: string;
  challengeHash: Buffer;
  userHandle: Buffer | null;
}

function base64url(value: unknown): Buffer | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8192) return null;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.toString('base64url') === value.replace(/=+$/, '') ? bytes : null;
}

export function hashChallenge(challenge: Buffer): Buffer {
  return createHash('sha256').update(challenge).digest();
}

export function readCredential(credential: Record<string, unknown>): CredentialInput | null {
  const response = credential.response as Record<string, unknown> | undefined;
  if (!response || typeof response !== 'object') return null;
  const credentialId = base64url(credential.rawId);
  if (!credentialId || credential.id !== credential.rawId) return null;
  const clientData = base64url(response.clientDataJSON);
  if (!clientData) return null;
  let challenge: unknown;
  try {
    challenge = (JSON.parse(clientData.toString('utf8')) as { challenge?: unknown }).challenge;
  } catch {
    return null;
  }
  const challengeBytes = base64url(challenge);
  if (!challengeBytes || challengeBytes.length !== 32) return null;
  const userHandle = response.userHandle == null ? null : base64url(response.userHandle);
  return {
    credentialId,
    challenge: challenge as string,
    challengeHash: hashChallenge(challengeBytes),
    userHandle,
  };
}

export function signCountAccepted(stored: number, received: number): boolean {
  return received > stored || (received === 0 && stored === 0);
}
