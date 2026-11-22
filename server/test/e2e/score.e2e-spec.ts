import { api, cleanup, createFixtures, scoreMismatches, signup, startApp, TestApp } from './support/app';

describe('F-082·F-083 프로필·활동 점수 (029)', () => {
  let t: TestApp;
  let postIds: number[];
  let admin = '';

  beforeAll(async () => {
    t = await startApp();
    ({ postIds } = await createFixtures(t, 45));
    const adminUser = await signup(t, 'sadmin');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id = ?", [adminUser.userId]);
    admin = (await api(t, 'POST', '/auth/login', { body: { email: adminUser.email, password: adminUser.password } })).body.accessToken;
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  const profile = async (token: string) => {
    const res = await api(t, 'GET', '/me/profile', { token });
    expect(res.status).toBe(200);
    return res.body;
  };
  const view = (token: string, postId: number) => api(t, 'POST', `/posts/${postId}/views`, { token });
  const comment = async (token: string, userId: number, postId: number, content = '댓글') => {
    const res = await api(t, 'POST', `/posts/${postId}/comments`, { token, body: { content } });
    expect(res.status).toBe(201);
    await t.db.query('UPDATE comments SET created_at = created_at - INTERVAL 2 MINUTE WHERE user_id = ?', [userId]);
    return res.body.comment.id as number;
  };

  it('프로필 초기값, 비회원 401', async () => {
    const user = await signup(t, 'score-init');
    expect(await profile(user.token)).toEqual({
      nickname: expect.any(String),
      score: 0,
      grade: { level: 1, name: 'Hello World', minScore: 0, nextMinScore: 100 },
      stats: { likes: 0, comments: 0, reads: 0, bookmarks: 0 },
    });
    expect((await api(t, 'GET', '/me/profile')).status).toBe(401);
  });

  it('읽기: 같은 글 1회, KST 하루 30점, 초과분은 다음 날 다시 적립, 기록 삭제해도 점수 유지', async () => {
    const user = await signup(t, 'score-read');
    for (const id of postIds.slice(0, 31)) expect((await view(user.token, id)).status).toBe(204);
    await view(user.token, postIds[0]);
    let p = await profile(user.token);
    expect(p.score).toBe(30);
    expect(p.stats.reads).toBe(31);

    expect((await api(t, 'DELETE', `/me/history/${postIds[0]}`, { token: user.token })).status).toBe(204);
    p = await profile(user.token);
    expect(p.score).toBe(30);
    expect(p.stats.reads).toBe(30);
    await view(user.token, postIds[0]);
    expect((await profile(user.token)).score).toBe(30);

    await t.db.query("UPDATE score_events SET created_at = created_at - INTERVAL 1 DAY WHERE user_id = ? AND kind = 'READ'", [user.userId]);
    await view(user.token, postIds[30]);
    await view(user.token, postIds[1]);
    expect((await profile(user.token)).score).toBe(31);
  });

  it('읽기 동시 요청: 하루 한도 경계에서 정확히 남은 만큼만 적립', async () => {
    const user = await signup(t, 'score-race');
    for (const id of postIds.slice(0, 25)) await view(user.token, id);
    const results = await Promise.all(postIds.slice(25, 35).map((id) => view(user.token, id)));
    expect(results.every((r) => r.status === 204)).toBe(true);
    expect((await profile(user.token)).score).toBe(30);
  });

  it('좋아요 +2, 멱등, 취소 회수, 다시 누르면 다시 +2', async () => {
    const user = await signup(t, 'score-like');
    const like = (on: boolean) => api(t, on ? 'PUT' : 'DELETE', `/posts/${postIds[0]}/like`, { token: user.token });
    await like(true);
    await like(true);
    expect((await profile(user.token)).score).toBe(2);
    await like(false);
    await like(false);
    let p = await profile(user.token);
    expect(p.score).toBe(0);
    expect(p.stats.likes).toBe(0);
    await like(true);
    p = await profile(user.token);
    expect(p.score).toBe(2);
    expect(p.stats.likes).toBe(1);

    await Promise.all(Array.from({ length: 20 }, (_, i) => like(i % 2 === 0)));
    const [{ liked }] = (await t.db.query('SELECT COUNT(*) AS liked FROM post_likes WHERE user_id = ? AND post_id = ?', [
      user.userId,
      postIds[0],
    ])) as { liked: number | string }[];
    expect((await profile(user.token)).score).toBe(Number(liked) * 2);
  });

  it('댓글: 하루 처음 10개만 +5, 삭제·숨김 회수, 숨김 해제 복구, 회수된 행도 한도에 셈', async () => {
    const user = await signup(t, 'score-comment');
    const ids: number[] = [];
    for (let i = 0; i < 11; i++) ids.push(await comment(user.token, user.userId, postIds[i % 3], `댓글 ${i}`));
    let p = await profile(user.token);
    expect(p.score).toBe(50);
    expect(p.stats.comments).toBe(11);

    expect((await api(t, 'DELETE', `/comments/${ids[0]}`, { token: user.token })).status).toBe(200);
    expect((await profile(user.token)).score).toBe(45);
    expect((await api(t, 'DELETE', `/comments/${ids[10]}`, { token: user.token })).status).toBe(200);
    expect((await profile(user.token)).score).toBe(45);
    await comment(user.token, user.userId, postIds[0], '한도 뒤 댓글');
    expect((await profile(user.token)).score).toBe(45);

    expect((await api(t, 'PUT', `/admin/comments/${ids[1]}/hidden`, { token: admin })).status).toBe(200);
    expect((await api(t, 'PUT', `/admin/comments/${ids[1]}/hidden`, { token: admin })).status).toBe(200);
    p = await profile(user.token);
    expect(p.score).toBe(40);
    expect(p.stats.comments).toBe(9);
    expect((await api(t, 'DELETE', `/admin/comments/${ids[1]}/hidden`, { token: admin })).status).toBe(200);
    expect((await profile(user.token)).score).toBe(45);

    expect((await api(t, 'PUT', `/admin/comments/${ids[2]}/hidden`, { token: admin })).status).toBe(200);
    expect((await api(t, 'DELETE', `/comments/${ids[2]}`, { token: user.token })).status).toBe(200);
    expect((await api(t, 'DELETE', `/admin/comments/${ids[2]}/hidden`, { token: admin })).status).toBe(404);
    expect((await profile(user.token)).score).toBe(40);
  });

  it('답글이 있는 댓글 삭제(자리 표시)도 회수, 답글 작성자 점수는 그대로', async () => {
    const a = await signup(t, 'score-parent');
    const b = await signup(t, 'score-reply');
    const top = await comment(a.token, a.userId, postIds[5], '부모');
    const reply = await api(t, 'POST', `/posts/${postIds[5]}/comments`, { token: b.token, body: { content: '답글', parentId: top } });
    expect(reply.status).toBe(201);
    const removed = await api(t, 'DELETE', `/comments/${top}`, { token: a.token });
    expect(removed.body.removed).toBe(false);
    expect((await profile(a.token)).score).toBe(0);
    expect((await profile(b.token)).score).toBe(5);
  });

  it('등급 경계와 댓글 작성자 등급', async () => {
    const user = await signup(t, 'score-grade');
    await t.db.query("INSERT INTO score_events (user_id, kind, ref_id, points) VALUES (?, 'ARCHIVE', 0, 99)", [user.userId]);
    await t.db.query('UPDATE users SET score = 99 WHERE id = ?', [user.userId]);
    expect((await profile(user.token)).grade).toEqual({ level: 1, name: 'Hello World', minScore: 0, nextMinScore: 100 });
    await view(user.token, postIds[40]);
    expect((await profile(user.token)).grade).toEqual({ level: 2, name: 'Junior Dev', minScore: 100, nextMinScore: 500 });

    await comment(user.token, user.userId, postIds[40], '등급 확인');
    const list = await api(t, 'GET', `/posts/${postIds[40]}/comments`);
    expect(list.body.items[0].author).toEqual({ id: user.userId, nickname: expect.any(String), grade: { level: 2, name: 'Junior Dev' } });

    await t.db.query("UPDATE score_events SET points = 4994 WHERE user_id = ? AND kind = 'ARCHIVE'", [user.userId]);
    await t.db.query('UPDATE users SET score = 5000 WHERE id = ?', [user.userId]);
    expect((await profile(user.token)).grade).toEqual({ level: 5, name: 'Architect', minScore: 5000, nextMinScore: null });
  });

  it('수치는 실제 행 수와 일치, 정합성 검사 6항목 0', async () => {
    const user = await signup(t, 'score-stats');
    await view(user.token, postIds[0]);
    await view(user.token, postIds[1]);
    await api(t, 'PUT', `/me/bookmarks/${postIds[0]}`, { token: user.token });
    await api(t, 'PUT', `/posts/${postIds[2]}/like`, { token: user.token });
    await comment(user.token, user.userId, postIds[2]);
    expect(await profile(user.token)).toMatchObject({ score: 9, stats: { likes: 1, comments: 1, reads: 2, bookmarks: 1 } });
    expect(await scoreMismatches(t)).toEqual({
      score_mismatch: 0,
      like_without_event: 0,
      event_without_like: 0,
      comment_revoke_mismatch: 0,
      deleted_comment_not_revoked: 0,
      comment_without_event: 0,
    });
  });
});
