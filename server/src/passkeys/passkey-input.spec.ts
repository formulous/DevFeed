import { randomBytes } from 'node:crypto';
import { hashChallenge, readCredential, signCountAccepted } from './passkey-input';

function credential(challenge: string, extra: Record<string, unknown> = {}) {
  const id = randomBytes(16).toString('base64url');
  const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge })).toString('base64url');
  return { id, rawId: id, type: 'public-key', response: { clientDataJSON, ...extra } };
}

describe('readCredential', () => {
  it('clientDataJSON 챌린지를 꺼내 해시함', () => {
    const bytes = randomBytes(32);
    const input = readCredential(credential(bytes.toString('base64url')));
    expect(input?.challengeHash.equals(hashChallenge(bytes))).toBe(true);
    expect(input?.userHandle).toBeNull();
  });

  it('userHandle이 있으면 바이트로 반환', () => {
    const handle = randomBytes(32);
    const input = readCredential(
      credential(randomBytes(32).toString('base64url'), { userHandle: handle.toString('base64url') }),
    );
    expect(input?.userHandle?.equals(handle)).toBe(true);
  });

  it('형식이 틀리면 null', () => {
    expect(readCredential({})).toBeNull();
    expect(readCredential(credential('짧음'))).toBeNull();
    expect(readCredential(credential(randomBytes(16).toString('base64url')))).toBeNull();
    const c = credential(randomBytes(32).toString('base64url'));
    expect(readCredential({ ...c, id: 'other' })).toBeNull();
    expect(readCredential({ ...c, response: { clientDataJSON: '!!' } })).toBeNull();
  });
});

describe('signCountAccepted', () => {
  it('증가만 허용, 0을 계속 쓰는 인증기는 허용', () => {
    expect(signCountAccepted(5, 6)).toBe(true);
    expect(signCountAccepted(5, 5)).toBe(false);
    expect(signCountAccepted(5, 4)).toBe(false);
    expect(signCountAccepted(5, 0)).toBe(false);
    expect(signCountAccepted(0, 0)).toBe(true);
    expect(signCountAccepted(0, 1)).toBe(true);
  });
});
