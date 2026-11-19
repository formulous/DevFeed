import { api, cleanup, createFixtures, signup, startApp, TestApp, uniqueEmail } from './support/app';

describe('M4 회원 흐름: 가입 → 온보딩 → 북마크 → 읽은 기록', () => {
  let t: TestApp;
  let fx: Awaited<ReturnType<typeof createFixtures>>;

  beforeAll(async () => {
    t = await startApp();
    fx = await createFixtures(t, 5);
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('가입 검증과 중복 이메일', async () => {
    const weak = await api(t, 'POST', '/auth/signup', {
      body: { email: uniqueEmail(t, 'weak'), password: 'abcdefgh', nickname: '약한' },
    });
    expect(weak.status).toBe(400);
    expect(weak.body.fieldErrors.map((e: { field: string }) => e.field)).toEqual(['password']);

    const user = await signup(t, 'dup');
    const dup = await api(t, 'POST', '/auth/signup', {
      body: { email: user.email.toUpperCase(), password: 'pass1234', nickname: '중복' },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('EMAIL_DUPLICATED');
  });

  it('전체 흐름', async () => {
    const user = await signup(t, 'flow');
    let me = await api(t, 'GET', '/me', { token: user.token });
    expect(me.body).toMatchObject({ role: 'USER', hasInterestTags: false, onboardingCompleted: false });

    expect((await api(t, 'PUT', '/me/interest-tags', { token: user.token, body: { tagIds: fx.tagIds.slice(0, 2) } })).status).toBe(400);
    const unknown = await api(t, 'PUT', '/me/interest-tags', { token: user.token, body: { tagIds: [...fx.tagIds.slice(0, 2), 999999999] } });
    expect(unknown.body.fieldErrors[0].message).toBe('존재하지 않는 태그가 있음');
    const saved = await api(t, 'PUT', '/me/interest-tags', { token: user.token, body: { tagIds: fx.tagIds.slice(0, 3) } });
    expect(saved.status).toBe(200);
    expect(saved.body.items).toHaveLength(3);
    me = await api(t, 'GET', '/me', { token: user.token });
    expect(me.body).toMatchObject({ hasInterestTags: true, onboardingCompleted: true });

    for (const postId of [fx.postIds[0], fx.postIds[1], fx.postIds[1]]) {
      expect((await api(t, 'PUT', `/me/bookmarks/${postId}`, { token: user.token })).status).toBe(204);
    }
    expect((await api(t, 'PUT', '/me/bookmarks/999999999', { token: user.token })).status).toBe(404);
    let bookmarks = await api(t, 'GET', '/me/bookmarks?size=1', { token: user.token });
    expect(bookmarks.body.total).toBe(2);
    expect(bookmarks.body.items[0]).toMatchObject({ id: fx.postIds[1], isBookmarked: true });
    expect(typeof bookmarks.body.items[0].bookmarkedAt).toBe('string');
    const next = await api(t, 'GET', `/me/bookmarks?size=1&cursor=${encodeURIComponent(bookmarks.body.nextCursor)}`, { token: user.token });
    expect(next.body.items.map((i: { id: number }) => i.id)).toEqual([fx.postIds[0]]);
    expect(next.body.nextCursor).toBeNull();
    const byTag = await api(t, 'GET', `/me/bookmarks?tagIds=${fx.tagIds[0]}`, { token: user.token });
    expect(byTag.body.items.map((i: { id: number }) => i.id)).toEqual([fx.postIds[0]]);
    expect(byTag.body.total).toBe(2);

    const feed = await api(t, 'GET', `/posts?sourceIds=${fx.sourceId}`, { token: user.token });
    const flags = Object.fromEntries(feed.body.items.map((i: { id: number; isBookmarked: boolean }) => [i.id, i.isBookmarked]));
    expect(flags[fx.postIds[0]]).toBe(true);
    expect(flags[fx.postIds[2]]).toBe(false);

    expect((await api(t, 'DELETE', `/me/bookmarks/${fx.postIds[0]}`, { token: user.token })).status).toBe(204);
    expect((await api(t, 'DELETE', `/me/bookmarks/${fx.postIds[0]}`, { token: user.token })).status).toBe(204);
    bookmarks = await api(t, 'GET', '/me/bookmarks', { token: user.token });
    expect(bookmarks.body.total).toBe(1);

    for (const postId of [fx.postIds[2], fx.postIds[3], fx.postIds[2]]) {
      expect((await api(t, 'POST', `/posts/${postId}/views`, { token: user.token })).status).toBe(204);
    }
    let history = await api(t, 'GET', '/me/history', { token: user.token });
    expect(history.body.items.map((i: { id: number }) => i.id)).toEqual([fx.postIds[2], fx.postIds[3]]);
    expect(history.body.items[0]).toMatchObject({ isRead: true });
    expect(typeof history.body.items[0].readAt).toBe('string');

    expect((await api(t, 'DELETE', `/me/history/${fx.postIds[2]}`, { token: user.token })).status).toBe(204);
    history = await api(t, 'GET', '/me/history', { token: user.token });
    expect(history.body.items.map((i: { id: number }) => i.id)).toEqual([fx.postIds[3]]);
    expect((await api(t, 'DELETE', '/me/history', { token: user.token })).status).toBe(204);
    history = await api(t, 'GET', '/me/history', { token: user.token });
    expect(history.body).toEqual({ items: [], nextCursor: null });

    const renamed = await api(t, 'PATCH', '/me', { token: user.token, body: { nickname: '  새닉네임 ' } });
    expect(renamed.body.nickname).toBe('새닉네임');
  });

  it('온보딩 건너뛰기는 멱등', async () => {
    const user = await signup(t, 'skip');
    expect((await api(t, 'POST', '/me/onboarding/complete', { token: user.token })).status).toBe(204);
    expect((await api(t, 'POST', '/me/onboarding/complete', { token: user.token })).status).toBe(204);
    const me = await api(t, 'GET', '/me', { token: user.token });
    expect(me.body).toMatchObject({ onboardingCompleted: true, hasInterestTags: false });
  });

  it('북마크 5,000건 제한', async () => {
    const user = await signup(t, 'limit');
    await t.db.query(
      `INSERT INTO posts (source_id, source_type, url, title, published_at)
       WITH d (v) AS (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)
       SELECT ?, 'COMPANY', CONCAT(?, n), CONCAT('bulk ', n), '2026-01-01'
         FROM (SELECT a.v + b.v * 10 + c.v * 100 + e.v * 1000 + 1 AS n FROM d a, d b, d c, d e) seq
        WHERE n <= 5001`,
      [fx.sourceId, `https://e2e-${t.runId}.test/bulk/`],
    );
    await t.db.query(
      `INSERT INTO bookmarks (user_id, post_id, created_at)
       SELECT ?, id, UTC_TIMESTAMP(3) FROM posts WHERE source_id = ? AND url LIKE ? ORDER BY id LIMIT 5000`,
      [user.userId, fx.sourceId, `https://e2e-${t.runId}.test/bulk/%`],
    );
    const [extra] = (await t.db.query(
      'SELECT id FROM posts WHERE source_id = ? AND url LIKE ? ORDER BY id DESC LIMIT 1',
      [fx.sourceId, `https://e2e-${t.runId}.test/bulk/%`],
    )) as { id: number }[];
    const res = await api(t, 'PUT', `/me/bookmarks/${extra.id}`, { token: user.token });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BOOKMARK_LIMIT_EXCEEDED');
    const already = (await t.db.query('SELECT post_id FROM bookmarks WHERE user_id = ? LIMIT 1', [user.userId])) as { post_id: number }[];
    expect((await api(t, 'PUT', `/me/bookmarks/${already[0].post_id}`, { token: user.token })).status).toBe(204);
  });
});
