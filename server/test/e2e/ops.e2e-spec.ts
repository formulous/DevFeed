import { api, cleanup, startApp, TestApp, uniqueEmail } from './support/app';

describe('M6 운영: 헬스 체크·보안 헤더·속도 제한·실제 IP', () => {
  let t: TestApp;

  beforeAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'true';
    t = await startApp();
  });

  afterAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    await cleanup(t);
    await t.close();
  });

  const signupFrom = (ip: string, label: string) =>
    fetch(`${t.base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ email: uniqueEmail(t, label), password: 'pass1234', nickname: '제한검증' }),
    });

  it('헬스 체크는 DB까지 확인하고 보안 헤더를 붙임', async () => {
    const res = await fetch(`${t.base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'OK', db: 'OK' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('가입은 IP당 10분 5회, 초과 시 429 RATE_LIMITED + Retry-After, 다른 IP는 별도', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await signupFrom('203.0.113.10', `rl${i}`)).status);
    expect(statuses).toEqual([201, 201, 201, 201, 201]);

    const blocked = await signupFrom('203.0.113.10', 'rl5');
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

    expect((await signupFrom('203.0.113.11', 'rl-other')).status).toBe(201);
  });

  it('헬스 체크는 속도 제한에서 제외됨', async () => {
    const results = await Promise.all(Array.from({ length: 130 }, () => fetch(`${t.base}/health`).then((r) => r.status)));
    expect(results.every((s) => s === 200)).toBe(true);
  });

  it('기본 한도: 같은 IP 1분 120회 초과 시 429', async () => {
    const results: number[] = [];
    for (let i = 0; i < 121; i++) {
      const r = await fetch(`${t.base}/tags?size=1`, { headers: { 'X-Forwarded-For': '203.0.113.20' } });
      results.push(r.status);
      await r.arrayBuffer();
    }
    expect(results.slice(0, 120).every((s) => s === 200)).toBe(true);
    expect(results[120]).toBe(429);
    expect((await api(t, 'GET', '/tags?size=1')).status).toBe(200);
  });
});
