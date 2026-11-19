import { api, cleanup, createFixtures, startApp, TestApp } from './support/app';

describe('GET /api/sources postCount (018)', () => {
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
    const res = await api(t, 'GET', '/sources');
    expect(res.status).toBe(200);
    const mine = res.body.items.find((s: { id: number }) => s.id === fx.sourceId);
    expect(mine).toEqual({ id: fx.sourceId, name: `e2e ${t.runId}`, logoUrl: null, type: 'COMPANY', postCount: 4 });
    for (const item of res.body.items) expect(Number.isInteger(item.postCount)).toBe(true);
  });
});
