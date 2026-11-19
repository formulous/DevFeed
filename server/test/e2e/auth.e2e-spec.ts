import { api, cleanup, refreshCookieFrom, signup, startApp, TestApp } from './support/app';

describe('인증: 리프레시 토큰 교체·재사용 탐지·잠금', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startApp();
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('재발급마다 교체, 30초 지난 폐기 토큰 재사용 시 같은 계열 전체 폐기', async () => {
    const user = await signup(t, 'rotate');
    const first = await api(t, 'POST', '/auth/refresh', { cookie: user.cookie });
    expect(first.status).toBe(200);
    const second = refreshCookieFrom(first.cookies);
    expect(second).not.toBe(user.cookie);

    const graceReuse = await api(t, 'POST', '/auth/refresh', { cookie: user.cookie });
    expect(graceReuse.status).toBe(401);
    expect((await api(t, 'POST', '/auth/refresh', { cookie: second })).status).toBe(200);

    await t.db.query(
      'UPDATE refresh_tokens SET revoked_at = revoked_at - INTERVAL 31 SECOND WHERE user_id = ? AND revoked_at IS NOT NULL',
      [user.userId],
    );
    const [{ active }] = (await t.db.query(
      'SELECT COUNT(*) AS active FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL',
      [user.userId],
    )) as { active: number | string }[];
    expect(Number(active)).toBe(1);

    const reuse = await api(t, 'POST', '/auth/refresh', { cookie: user.cookie });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_INVALID');
    const [{ remaining }] = (await t.db.query(
      'SELECT COUNT(*) AS remaining FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL',
      [user.userId],
    )) as { remaining: number | string }[];
    expect(Number(remaining)).toBe(0);
  });

  it('로그아웃 후 리프레시 401, 5회 실패 잠금 423', async () => {
    const user = await signup(t, 'lock');
    expect((await api(t, 'POST', '/auth/logout', { cookie: user.cookie })).status).toBe(204);
    expect((await api(t, 'POST', '/auth/refresh', { cookie: user.cookie })).status).toBe(401);

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await api(t, 'POST', '/auth/login', { body: { email: user.email, password: `wrong${i}xx` } })).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 423]);
    const locked = await api(t, 'POST', '/auth/login', { body: { email: user.email, password: user.password } });
    expect(locked.status).toBe(423);
    expect(locked.body.retryAfterSec).toBeGreaterThan(590);
  });
});
