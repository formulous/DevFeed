import { api, cleanup, createFixtures, residualPersonalData, signup, startApp, TestApp } from './support/app';

describe('F-032 탈퇴 후 개인 데이터 잔존 (002 결정 필수)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startApp();
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('개인 데이터 14개 테이블 잔존 0건, 추천 로그 익명화, 조회수 유지', async () => {
    const { tagIds, postIds } = await createFixtures(t, 3);
    const user = await signup(t, 'withdraw');

    expect((await api(t, 'PUT', '/me/interest-tags', { token: user.token, body: { tagIds: tagIds.slice(0, 3) } })).status).toBe(200);
    expect((await api(t, 'PUT', `/me/bookmarks/${postIds[0]}`, { token: user.token })).status).toBe(204);
    expect((await api(t, 'POST', `/posts/${postIds[1]}/views`, { token: user.token })).status).toBe(204);
    expect((await api(t, 'PUT', `/posts/${postIds[0]}/like`, { token: user.token })).status).toBe(200);
    expect((await api(t, 'POST', `/posts/${postIds[0]}/comments`, { token: user.token, body: { content: '탈퇴 전 댓글' } })).status).toBe(201);
    await t.db.query(
      `INSERT INTO recommendation_impressions (request_id, user_id, post_id, algorithm, position, shown_at)
       VALUES (UNHEX(REPLACE(UUID(), '-', '')), ?, ?, 'TAG_V1', 1, UTC_TIMESTAMP(3))`,
      [user.userId, postIds[2]],
    );

    const before = await residualPersonalData(t, user.userId);
    expect(before).toEqual({
      users: 1,
      refresh_tokens: 1,
      user_interest_tags: 3,
      bookmarks: 1,
      read_histories: 1,
      recommendation_impressions: 1,
      post_view_guards: 1,
      post_likes: 1,
      comments: 1,
      user_passkeys: 0,
      webauthn_challenges: 0,
      community_posts: 0,
      reports: 0,
      score_events: 3,
    });

    const wrong = await api(t, 'POST', '/me/withdraw', { token: user.token, body: { password: 'wrong999' } });
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe('PASSWORD_MISMATCH');
    expect((await residualPersonalData(t, user.userId)).users).toBe(1);

    const res = await api(t, 'POST', '/me/withdraw', { token: user.token, body: { password: user.password } });
    expect(res.status).toBe(204);
    expect(res.cookies.some((c) => c.startsWith('df_rt=;') && c.includes('Max-Age=0'))).toBe(true);

    expect(await residualPersonalData(t, user.userId)).toEqual({
      users: 0,
      refresh_tokens: 0,
      user_interest_tags: 0,
      bookmarks: 0,
      read_histories: 0,
      recommendation_impressions: 0,
      post_view_guards: 0,
      post_likes: 0,
      comments: 0,
      user_passkeys: 0,
      webauthn_challenges: 0,
      community_posts: 0,
      reports: 0,
      score_events: 0,
    });

    const [impression] = (await t.db.query('SELECT user_id FROM recommendation_impressions WHERE post_id = ?', [
      postIds[2],
    ])) as { user_id: number | null }[];
    expect(impression).toEqual({ user_id: null });

    const [post] = (await t.db.query('SELECT view_count FROM posts WHERE id = ?', [postIds[1]])) as { view_count: number }[];
    expect(post.view_count).toBe(1);
  });

  it('탈퇴 후 로그인·리프레시·남은 액세스 토큰 사용이 모두 거부됨', async () => {
    const { postIds } = await createFixtures(t, 1).catch(async () => ({ postIds: [] as number[] }));
    const user = await signup(t, 'after');
    expect((await api(t, 'POST', '/me/withdraw', { token: user.token, body: { password: user.password } })).status).toBe(204);

    const login = await api(t, 'POST', '/auth/login', { body: { email: user.email, password: user.password } });
    expect(login.status).toBe(401);
    expect(login.body.code).toBe('INVALID_CREDENTIALS');
    expect((await api(t, 'POST', '/auth/refresh', { cookie: user.cookie })).status).toBe(401);
    expect((await api(t, 'GET', '/me', { token: user.token })).body.code).toBe('UNAUTHENTICATED');
    if (postIds.length) {
      const bookmark = await api(t, 'PUT', `/me/bookmarks/${postIds[0]}`, { token: user.token });
      expect(bookmark.status).toBe(401);
      expect((await api(t, 'POST', `/posts/${postIds[0]}/views`, { token: user.token })).status).toBe(204);
    }
  });
});
