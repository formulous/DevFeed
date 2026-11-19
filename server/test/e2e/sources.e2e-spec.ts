import { api, cleanup, createFixtures, startApp, TestApp } from './support/app';

describe('GET /api/sources postCount·recentPostCount (018, 019)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startApp();
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('소스마다 전체 글 수를 포함하고 글카드용 필드는 그대로임', async () => {
    const fx = await createFixtures(t, 4);
    await t.db.query('UPDATE posts SET published_at = UTC_TIMESTAMP(3) - INTERVAL 2 DAY WHERE id IN (?, ?)', [fx.postIds[0], fx.postIds[1]]);
    await t.db.query('UPDATE posts SET published_at = UTC_TIMESTAMP(3) - INTERVAL 31 DAY WHERE id = ?', [fx.postIds[2]]);
    await t.db.query('UPDATE posts SET published_at = UTC_TIMESTAMP(3) - INTERVAL 29 DAY WHERE id = ?', [fx.postIds[3]]);
    const res = await api(t, 'GET', '/sources');
    expect(res.status).toBe(200);
    const mine = res.body.items.find((s: { id: number }) => s.id === fx.sourceId);
    expect(mine).toEqual({ id: fx.sourceId, name: `e2e ${t.runId}`, logoUrl: null, type: 'COMPANY', postCount: 4, recentPostCount: 3 });
    for (const item of res.body.items) {
      expect(Number.isInteger(item.postCount)).toBe(true);
      expect(item.recentPostCount).toBeLessThanOrEqual(item.postCount);
    }
  });
});
