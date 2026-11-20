import { api, cleanup, createFixtures, signup, startApp, TestApp } from './support/app';

describe('글 카드 인기 배지 isPopular (020)', () => {
  let t: TestApp;
  let fx: Awaited<ReturnType<typeof createFixtures>>;

  beforeAll(async () => {
    t = await startApp();
    fx = await createFixtures(t, 4);
    const now = Date.now();
    const setup: [number, number][] = [
      [60_000, 3],
      [120_000, 0],
      [8 * 24 * 3_600_000, 9],
      [180_000, 1],
    ];
    for (const [i, [ago, views]] of setup.entries()) {
      await t.db.query('UPDATE posts SET published_at = ?, view_count = ? WHERE id = ?', [new Date(now - ago), views, fx.postIds[i]]);
    }
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('7일 인기 상위 집합에 든 글만 true, 조회수 0·7일 지난 글은 false', async () => {
    const popular = await api(t, 'GET', '/posts/popular?period=WEEK');
    const popularIds = new Set(popular.body.items.map((i: { id: number }) => i.id));
    expect(popularIds.has(fx.postIds[0])).toBe(true);
    expect(popularIds.has(fx.postIds[3])).toBe(true);

    const feed = await api(t, 'GET', `/posts?sourceIds=${fx.sourceId}`);
    const flag = new Map(feed.body.items.map((i: { id: number; isPopular: boolean }) => [i.id, i.isPopular]));
    expect(fx.postIds.map((id) => flag.get(id))).toEqual([true, false, false, true]);
    for (const item of popular.body.items) expect(item.isPopular).toBe(true);
  });

  it('회원 응답에도 isPopular가 들어감', async () => {
    const user = await signup(t, 'badge');
    const feed = await api(t, 'GET', `/posts?sourceIds=${fx.sourceId}`, { token: user.token });
    expect(feed.body.items.every((i: { isPopular: unknown; isRead: unknown }) => typeof i.isPopular === 'boolean' && typeof i.isRead === 'boolean')).toBe(true);
  });
});
