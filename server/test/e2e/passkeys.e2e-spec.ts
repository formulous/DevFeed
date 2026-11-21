import { APP_ENV } from '../../src/config/env';
import type { AppEnv } from '../../src/config/env';
import { api, cleanup, refreshCookieFrom, residualPersonalData, signup, startApp, TestApp } from './support/app';
import { VirtualAuthenticator, WebauthnRp } from './support/webauthn';

describe('F-034 패스키 (027)', () => {
  let t: TestApp;
  let rp: WebauthnRp;

  beforeAll(async () => {
    t = await startApp();
    const env = t.app.get<AppEnv>(APP_ENV);
    rp = { rpId: env.webauthn.rpId, origin: env.webauthn.origins[0] };
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  async function register(token: string, authenticator: VirtualAuthenticator, name?: string) {
    const options = await api(t, 'POST', '/me/passkeys/registration/options', { token });
    expect(options.status).toBe(200);
    return api(t, 'POST', '/me/passkeys', {
      token,
      body: { credential: authenticator.create(options.body), ...(name ? { name } : {}) },
    });
  }

  async function loginChallenge(): Promise<string> {
    const res = await api(t, 'POST', '/auth/passkeys/login/options');
    expect(res.status).toBe(200);
    return res.body.challenge;
  }

  it('가입 → 패스키 등록 → 로그아웃 → 패스키 로그인, 기존 토큰 체계 그대로', async () => {
    const user = await signup(t, 'pk-flow');
    const options = await api(t, 'POST', '/me/passkeys/registration/options', { token: user.token });
    expect(options.status).toBe(200);
    expect(options.body).toMatchObject({
      rp: { id: rp.rpId, name: 'DevFeed' },
      user: { name: user.email },
      attestation: 'none',
      excludeCredentials: [],
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    });
    expect(Buffer.from(options.body.user.id, 'base64url')).toHaveLength(32);
    const again = await api(t, 'POST', '/me/passkeys/registration/options', { token: user.token });
    expect(again.body.user.id).toBe(options.body.user.id);
    expect(again.body.challenge).not.toBe(options.body.challenge);

    const authenticator = new VirtualAuthenticator(rp);
    const created = await api(t, 'POST', '/me/passkeys', {
      token: user.token,
      body: { credential: authenticator.create(options.body), name: '  MacBook Chrome  ' },
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: expect.any(Number), name: 'MacBook Chrome', createdAt: expect.any(String), lastUsedAt: null });

    const excluded = await api(t, 'POST', '/me/passkeys/registration/options', { token: user.token });
    expect(excluded.body.excludeCredentials).toEqual([{ id: authenticator.id, type: 'public-key', transports: ['internal', 'hybrid'] }]);

    expect((await api(t, 'POST', '/auth/logout', { cookie: user.cookie })).status).toBe(204);

    const loginOptions = await api(t, 'POST', '/auth/passkeys/login/options');
    expect(loginOptions.status).toBe(200);
    expect(loginOptions.body).toMatchObject({ rpId: rp.rpId, userVerification: 'required', allowCredentials: [], timeout: 300000 });

    const login = await api(t, 'POST', '/auth/passkeys/login', {
      body: { credential: authenticator.assert({ challenge: loginOptions.body.challenge }) },
    });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(user.userId);
    const cookie = refreshCookieFrom(login.cookies);
    expect((await api(t, 'GET', '/me', { token: login.body.accessToken })).status).toBe(200);
    expect((await api(t, 'POST', '/auth/refresh', { cookie })).status).toBe(200);

    const list = await api(t, 'GET', '/me/passkeys', { token: login.body.accessToken });
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].lastUsedAt).not.toBeNull();

    const zeroAgain = await api(t, 'POST', '/auth/passkeys/login', {
      body: { credential: authenticator.assert({ challenge: await loginChallenge() }) },
    });
    expect(zeroAgain.status).toBe(200);
  });

  it('재사용 챌린지·다른 origin·다른 RP ID·사용자 확인 없음·서명 횟수 역행 → PASSKEY_VERIFICATION_FAILED', async () => {
    const user = await signup(t, 'pk-reject');
    const authenticator = new VirtualAuthenticator(rp, { counter: 5 });
    expect((await register(user.token, authenticator)).status).toBe(201);

    const expectFailed = async (credential: unknown) => {
      const res = await api(t, 'POST', '/auth/passkeys/login', { body: { credential } });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('PASSKEY_VERIFICATION_FAILED');
      expect(res.body.message).toBe('패스키를 확인하지 못했어요. 다시 시도해 주세요');
    };

    const challenge = await loginChallenge();
    expect(
      (await api(t, 'POST', '/auth/passkeys/login', { body: { credential: authenticator.assert({ challenge }) } })).status,
    ).toBe(200);
    await expectFailed(authenticator.assert({ challenge }));

    await expectFailed(authenticator.assert({ challenge: await loginChallenge(), origin: 'https://evil.test' }));
    await expectFailed(authenticator.assert({ challenge: await loginChallenge(), rpId: 'evil.test' }));
    await expectFailed(authenticator.assert({ challenge: await loginChallenge(), userVerified: false }));
    await expectFailed(authenticator.assert({ challenge: await loginChallenge(), counter: 3 }));
    await expectFailed(authenticator.assert({ challenge: await loginChallenge(), counter: 6 }));
    await expectFailed(authenticator.assert({ challenge: await loginChallenge(), userHandle: Buffer.alloc(32).toString('base64url') }));

    const fake = Buffer.alloc(32, 1).toString('base64url');
    await expectFailed(authenticator.assert({ challenge: fake }));

    const [{ sign_count }] = (await t.db.query('SELECT sign_count FROM user_passkeys WHERE user_id = ?', [user.userId])) as {
      sign_count: number;
    }[];
    expect(sign_count).toBe(6);
    expect(
      (await api(t, 'POST', '/auth/passkeys/login', { body: { credential: authenticator.assert({ challenge: await loginChallenge() }) } }))
        .status,
    ).toBe(200);
  });

  it('같은 응답을 동시에 보내면 하나만 성공', async () => {
    const user = await signup(t, 'pk-race');
    const authenticator = new VirtualAuthenticator(rp, { counter: 1 });
    expect((await register(user.token, authenticator)).status).toBe(201);
    const credential = authenticator.assert({ challenge: await loginChallenge() });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => api(t, 'POST', '/auth/passkeys/login', { body: { credential } })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 401)).toHaveLength(4);
  });

  it('등록 안 된 패스키는 PASSKEY_NOT_FOUND, 형식 오류는 검증 실패', async () => {
    const stranger = new VirtualAuthenticator(rp);
    const res = await api(t, 'POST', '/auth/passkeys/login', {
      body: { credential: stranger.assert({ challenge: await loginChallenge(), userHandle: Buffer.alloc(32, 2).toString('base64url') }) },
    });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'PASSKEY_NOT_FOUND', message: '이 패스키로 가입된 계정을 찾을 수 없어요' });

    const malformed = await api(t, 'POST', '/auth/passkeys/login', { body: { credential: { id: 'x' } } });
    expect(malformed.status).toBe(401);
    expect(malformed.body.code).toBe('PASSKEY_VERIFICATION_FAILED');
    const missing = await api(t, 'POST', '/auth/passkeys/login', { body: {} });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('VALIDATION_FAILED');
  });

  it('등록 거부: 다른 회원 챌린지·재사용·다른 origin·사용자 확인 없음 400, 중복 409', async () => {
    const a = await signup(t, 'pk-reg-a');
    const b = await signup(t, 'pk-reg-b');
    const authenticator = new VirtualAuthenticator(rp);

    const expect400 = async (token: string, credential: unknown) => {
      const res = await api(t, 'POST', '/me/passkeys', { token, body: { credential } });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSKEY_VERIFICATION_FAILED');
    };

    const forA = await api(t, 'POST', '/me/passkeys/registration/options', { token: a.token });
    const credential = authenticator.create(forA.body);
    await expect400(b.token, credential);
    expect((await api(t, 'POST', '/me/passkeys', { token: a.token, body: { credential } })).status).toBe(201);
    await expect400(a.token, credential);

    const opts = async () => (await api(t, 'POST', '/me/passkeys/registration/options', { token: a.token })).body;
    await expect400(a.token, new VirtualAuthenticator(rp).create(await opts(), { origin: 'https://evil.test' }));
    await expect400(a.token, new VirtualAuthenticator(rp).create(await opts(), { userVerified: false }));
    const dup = await register(b.token, authenticator);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('PASSKEY_ALREADY_REGISTERED');

    const longName = await api(t, 'POST', '/me/passkeys', {
      token: a.token,
      body: { credential: new VirtualAuthenticator(rp).create(await opts()), name: 'x'.repeat(41) },
    });
    expect(longName.status).toBe(400);
    expect(longName.body.fieldErrors[0]).toEqual({ field: 'name', message: '이름은 1~40자로 입력해 주세요' });
  });

  it('이름 자동 생성·이름 바꾸기·삭제, 남의 패스키는 404, 11번째는 거부', async () => {
    const user = await signup(t, 'pk-manage');
    const other = await signup(t, 'pk-other');
    const first = await register(user.token, new VirtualAuthenticator(rp));
    expect(first.body.name).toBe('패스키 1');

    for (let i = 2; i <= 10; i++) expect((await register(user.token, new VirtualAuthenticator(rp), `기기 ${i}`)).status).toBe(201);
    const list = await api(t, 'GET', '/me/passkeys', { token: user.token });
    expect(list.body.items).toHaveLength(10);
    expect(list.body.items[0].name).toBe('기기 10');

    const full = await api(t, 'POST', '/me/passkeys/registration/options', { token: user.token });
    expect(full.status).toBe(409);
    expect(full.body).toMatchObject({ code: 'PASSKEY_LIMIT_EXCEEDED', message: '패스키는 10개까지 만들 수 있어요' });

    const id = first.body.id;
    const renamed = await api(t, 'PATCH', `/me/passkeys/${id}`, { token: user.token, body: { name: ' iPhone Safari ' } });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('iPhone Safari');
    expect((await api(t, 'PATCH', `/me/passkeys/${id}`, { token: user.token, body: { name: 'iPhone Safari' } })).status).toBe(200);
    expect((await api(t, 'PATCH', `/me/passkeys/${id}`, { token: user.token, body: { name: '   ' } })).status).toBe(400);
    expect((await api(t, 'PATCH', `/me/passkeys/${id}`, { token: other.token, body: { name: '남의 것' } })).status).toBe(404);
    expect((await api(t, 'DELETE', `/me/passkeys/${id}`, { token: other.token })).status).toBe(404);

    expect((await api(t, 'DELETE', `/me/passkeys/${id}`, { token: user.token })).status).toBe(204);
    expect((await api(t, 'DELETE', `/me/passkeys/${id}`, { token: user.token })).status).toBe(404);
    expect((await api(t, 'POST', '/me/passkeys/registration/options', { token: user.token })).status).toBe(200);

    const login = await api(t, 'POST', '/auth/login', { body: { email: user.email, password: user.password } });
    expect(login.status).toBe(200);
    expect((await api(t, 'GET', '/me/passkeys')).status).toBe(401);
  });

  it('비밀번호 잠금 중에도 패스키 로그인 가능, 잠금 상태는 유지', async () => {
    const user = await signup(t, 'pk-locked');
    const authenticator = new VirtualAuthenticator(rp);
    expect((await register(user.token, authenticator)).status).toBe(201);
    for (let i = 0; i < 5; i++) await api(t, 'POST', '/auth/login', { body: { email: user.email, password: 'wrong999' } });
    expect((await api(t, 'POST', '/auth/login', { body: { email: user.email, password: user.password } })).status).toBe(423);

    const res = await api(t, 'POST', '/auth/passkeys/login', {
      body: { credential: authenticator.assert({ challenge: await loginChallenge() }) },
    });
    expect(res.status).toBe(200);
    expect((await api(t, 'POST', '/auth/login', { body: { email: user.email, password: user.password } })).status).toBe(423);
  });

  it('탈퇴하면 패스키·등록 챌린지 잔존 0', async () => {
    const user = await signup(t, 'pk-withdraw');
    expect((await register(user.token, new VirtualAuthenticator(rp))).status).toBe(201);
    expect((await api(t, 'POST', '/me/passkeys/registration/options', { token: user.token })).status).toBe(200);
    const before = await residualPersonalData(t, user.userId);
    expect(before.user_passkeys).toBe(1);
    expect(before.webauthn_challenges).toBe(1);

    expect((await api(t, 'POST', '/me/withdraw', { token: user.token, body: { password: user.password } })).status).toBe(204);
    const after = await residualPersonalData(t, user.userId);
    expect(after.user_passkeys).toBe(0);
    expect(after.webauthn_challenges).toBe(0);
  });
});
