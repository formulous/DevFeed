import {
  api,
  cleanup,
  communityMismatches,
  createFixtures,
  reactionMismatches,
  residualPersonalData,
  scoreMismatches,
  signup,
  startApp,
  TestApp,
} from './support/app';

type User = Awaited<ReturnType<typeof signup>>;

process.env.POST_NEW_ACCOUNT_LIMIT_ENABLED = 'true';

describe('F-090~F-093 커뮤니티 (032)', () => {
  let t: TestApp;
  let tagIds: number[];
  let a: User;
  let b: User;
  let c: User;
  let d: User;
  let admin = '';
  const posts: Record<string, number> = {};

  const age = (user: User) => t.db.query('UPDATE users SET created_at = created_at - INTERVAL 2 DAY WHERE id = ?', [user.userId]);
  const cool = (user: User) =>
    t.db.query("UPDATE score_events SET created_at = created_at - INTERVAL 2 MINUTE WHERE user_id = ? AND kind = 'POST_WRITE'", [
      user.userId,
    ]);
  const score = async (user: User) => (await api(t, 'GET', '/me/profile', { token: user.token })).body.score as number;
  const write = async (user: User, body: Record<string, unknown>) => {
    const res = await api(t, 'POST', '/community/posts', { token: user.token, body });
    await cool(user);
    return res;
  };
  const listIds = async (path: string, token?: string) =>
    ((await api(t, 'GET', path, { token })).body.items as { id: number }[]).map((i) => i.id).filter((id) => Object.values(posts).includes(id));
  const comment = async (user: User, postId: number, content: string, parentId?: number) => {
    const res = await api(t, 'POST', `/posts/${postId}/comments`, { token: user.token, body: { content, parentId } });
    expect(res.status).toBe(201);
    return res.body.comment.id as number;
  };
  const checks = async () => {
    for (const mismatches of [await scoreMismatches(t), await reactionMismatches(t), await communityMismatches(t)]) {
      expect(Object.values(mismatches).every((n) => n === 0)).toBe(true);
    }
  };

  beforeAll(async () => {
    t = await startApp();
    ({ tagIds } = await createFixtures(t, 1));
    a = await signup(t, 'cm-a');
    b = await signup(t, 'cm-b');
    c = await signup(t, 'cm-c');
    d = await signup(t, 'cm-d');
    for (const user of [a, b, c, d]) await age(user);
    const adminUser = await signup(t, 'cm-admin');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id = ?", [adminUser.userId]);
    admin = (await api(t, 'POST', '/auth/login', { body: { email: adminUser.email, password: adminUser.password } })).body.accessToken;
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('작성 제한: 가입 24시간 미만 429, 사전 조회와 같은 사유, 관리자 예외', async () => {
    const fresh = await signup(t, 'cm-new');
    const status = await api(t, 'GET', '/community/write-status', { token: fresh.token });
    expect(status.body).toMatchObject({ allowed: false, reason: 'NEW_ACCOUNT', remainingToday: 5 });
    const denied = await api(t, 'POST', '/community/posts', {
      token: fresh.token,
      body: { category: 'SHARE', title: '새 계정 글', body: '본문은 열 글자 이상이에요' },
    });
    expect(denied.status).toBe(429);
    expect(denied.body).toMatchObject({ code: 'POST_WRITE_LIMITED', reason: 'NEW_ACCOUNT', availableAt: status.body.availableAt });
    expect(denied.body.retryAfterSec).toBeGreaterThan(80000);
    const adminStatus = await api(t, 'GET', '/community/write-status', { token: admin });
    expect(adminStatus.body).toEqual({ allowed: true, reason: null, availableAt: null, retryAfterSec: null, remainingToday: null });
    const adminPost = await api(t, 'POST', '/community/posts', {
      token: admin,
      body: { category: 'SHARE', title: '관리자 글', body: '관리자는 제한이 없어요' },
    });
    expect(adminPost.status).toBe(201);
    posts.admin = adminPost.body.id;
    expect((await api(t, 'GET', '/community/write-status')).status).toBe(401);
  });

  it('글 쓰기: 원문 마크다운 그대로 저장, 요약·주소·카드 필드, 검증 400', async () => {
    const body = '## 제목\n\n<script>alert(1)</script> <img src=x onerror=alert(1)> [a](javascript:alert(1))\n\n```ts\nconst a = 1;\n```\n';
    const res = await api(t, 'POST', '/community/posts', {
      token: a.token,
      body: { category: 'QUESTION', title: '  질문 있어요  ', body, tagIds: [tagIds[0]] },
    });
    expect(res.status).toBe(201);
    posts.p1 = res.body.id;
    expect(res.body).toMatchObject({
      kind: 'COMMUNITY',
      title: '질문 있어요',
      body,
      summary: '제목 alert(1) a',
      thumbnailUrl: null,
      isPopular: false,
      status: 'VISIBLE',
      acceptedCommentId: null,
      mine: true,
      reportedByMe: false,
      tags: [{ id: tagIds[0], name: expect.any(String) }],
      community: { category: 'QUESTION', author: { id: a.userId, grade: { level: 1 } }, editedAt: null, solved: false, viewCount: 0 },
    });
    expect(res.body.url).toMatch(new RegExp(`/community/posts/${posts.p1}$`));
    const cooldown = await api(t, 'POST', '/community/posts', {
      token: a.token,
      body: { category: 'SHARE', title: '바로 또', body: '60초 안에 다시 쓰면 막혀요' },
    });
    expect(cooldown.status).toBe(429);
    expect(cooldown.body.reason).toBe('COOLDOWN');
    await cool(a);
    const bad = async (over: Record<string, unknown>) =>
      (await api(t, 'POST', '/community/posts', {
        token: a.token,
        body: { category: 'SHARE', title: '정상 제목', body: '정상 본문 열 글자 이상', ...over },
      })).status;
    expect(await bad({ title: '한' })).toBe(400);
    expect(await bad({ title: '줄\n바꿈' })).toBe(400);
    expect(await bad({ body: '          짧음          ' })).toBe(400);
    expect(await bad({ body: `제어 문자\u0007 들어감` })).toBe(400);
    expect(await bad({ body: '가'.repeat(20001) })).toBe(400);
    expect(await bad({ category: 'NEWS' })).toBe(400);
    expect(await bad({ tagIds: [999999999] })).toBe(400);
    expect(await bad({ tagIds: [1, 2, 3, 4, 5, 6] })).toBe(400);
  });

  it('점수: 글 +10은 하루 3개분, 하루 5개 제한', async () => {
    const before = await score(a);
    for (const key of ['p2', 'p3', 'p4', 'p5']) {
      const res = await write(a, { category: key === 'p2' ? 'DISCUSSION' : 'SHARE', title: `글 ${key}`, body: `본문 ${key} 열 글자 이상` });
      expect(res.status).toBe(201);
      posts[key] = res.body.id;
    }
    expect((await score(a)) - before).toBe(20);
    const limited = await api(t, 'POST', '/community/posts', {
      token: a.token,
      body: { category: 'SHARE', title: '여섯 번째', body: '하루 다섯 개까지만 돼요' },
    });
    expect(limited.status).toBe(429);
    expect(limited.body.reason).toBe('DAILY_LIMIT');
    expect((await api(t, 'GET', '/community/write-status', { token: a.token })).body).toMatchObject({ allowed: false, remainingToday: 0 });
    expect((await api(t, 'GET', '/me/profile', { token: a.token })).body.stats.posts).toBe(5);
    await checks();
  });

  it('목록·인기: 최신순·말머리, 기술 뉴스와 분리', async () => {
    expect(await listIds('/community/posts?size=50')).toEqual([posts.p5, posts.p4, posts.p3, posts.p2, posts.p1, posts.admin]);
    expect(await listIds('/community/posts?category=QUESTION&size=50')).toEqual([posts.p1]);
    const first = await api(t, 'GET', '/community/posts?size=2');
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(await listIds('/posts?size=50')).toEqual([]);
    expect((await api(t, 'GET', '/community/posts?category=question')).status).toBe(400);
    const popular = await api(t, 'GET', '/community/popular?period=DAY');
    expect(popular.status).toBe(200);
    expect(popular.body.items.find((i: { id: number }) => i.id === posts.p1)).toMatchObject({ viewCount: 0, kind: 'COMMUNITY' });
    expect(await listIds('/posts/popular?period=DAY')).toEqual([]);
  });

  it('받은 좋아요 +1: 자기 글 0, 취소 시 회수, 하루 50점', async () => {
    const start = await score(a);
    expect((await api(t, 'PUT', `/posts/${posts.p1}/like`, { token: b.token })).status).toBe(200);
    expect((await score(a)) - start).toBe(1);
    await api(t, 'PUT', `/posts/${posts.p1}/like`, { token: a.token });
    expect((await score(a)) - start).toBe(1 + 2);
    await api(t, 'DELETE', `/posts/${posts.p1}/like`, { token: b.token });
    expect((await score(a)) - start).toBe(2);
    await checks();

    for (let i = 1; i <= 49; i++) {
      await t.db.query(
        "INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at) VALUES (?, 'LIKE_RECEIVED', ?, ?, 1, UTC_TIMESTAMP(3))",
        [a.userId, posts.p5, 900000000 + i],
      );
    }
    await t.db.query('UPDATE users SET score = score + 49 WHERE id = ?', [a.userId]);
    const capped = await score(a);
    await api(t, 'PUT', `/posts/${posts.p2}/like`, { token: c.token });
    expect((await score(a)) - capped).toBe(1);
    await api(t, 'PUT', `/posts/${posts.p2}/like`, { token: d.token });
    expect((await score(a)) - capped).toBe(1);
    await api(t, 'DELETE', `/posts/${posts.p2}/like`, { token: d.token });
    expect((await score(a)) - capped).toBe(1);
    await t.db.query("DELETE FROM score_events WHERE user_id = ? AND kind = 'LIKE_RECEIVED' AND actor_id > 900000000", [a.userId]);
    await t.db.query('UPDATE users SET score = score - 49 WHERE id = ?', [a.userId]);
    await checks();
  });

  it('채택: 질문글 작성자만, 내 댓글·답글·질문 아님 구분, 채택 댓글 삭제 불가, 말머리 변경 시 해제', async () => {
    const cb = await comment(b, posts.p1, '답변이에요');
    const ca = await comment(a, posts.p1, '제 댓글');
    const rb = await comment(b, posts.p1, '답글', cb);
    const accept = (token: string, postId: number, commentId: number) =>
      api(t, 'PUT', `/community/posts/${postId}/accepted-comment`, { token, body: { commentId } });
    expect((await accept(a.token, posts.p1, ca)).body.code).toBe('ACCEPT_OWN_COMMENT');
    expect((await accept(a.token, posts.p1, rb)).body.code).toBe('ACCEPT_REPLY');
    expect((await accept(b.token, posts.p1, cb)).status).toBe(403);
    const other = await comment(b, posts.p2, '토론 댓글');
    expect((await accept(a.token, posts.p2, other)).body.code).toBe('ACCEPT_NOT_QUESTION');
    expect((await accept(a.token, posts.p1, other)).status).toBe(404);
    const ok = await accept(a.token, posts.p1, cb);
    expect(ok.body).toEqual({ acceptedCommentId: cb, solved: true });
    expect((await api(t, 'GET', `/community/posts/${posts.p1}`)).body).toMatchObject({ acceptedCommentId: cb, community: { solved: true } });
    const removed = await api(t, 'DELETE', `/comments/${cb}`, { token: b.token });
    expect(removed.status).toBe(409);
    expect(removed.body.code).toBe('COMMENT_ACCEPTED');
    const share = await api(t, 'PATCH', `/community/posts/${posts.p1}`, { token: a.token, body: { category: 'SHARE' } });
    expect(share.body).toMatchObject({ acceptedCommentId: null, community: { category: 'SHARE', solved: false, editedAt: expect.any(String) } });
    await api(t, 'PATCH', `/community/posts/${posts.p1}`, { token: a.token, body: { category: 'QUESTION' } });
    await accept(a.token, posts.p1, cb);
    const cancel = await api(t, 'DELETE', `/community/posts/${posts.p1}/accepted-comment`, { token: a.token });
    expect(cancel.body).toEqual({ acceptedCommentId: null, solved: false });
    await accept(a.token, posts.p1, cb);
    posts.cb = cb;
  });

  it('댓글순·좋아요순: 1 이상만, 수 내림차순·같으면 최신, 말머리 필터 (035)', async () => {
    const mine = (path: string) => listIds(path).then((ids) => ids.filter((id) => Object.values(posts).includes(id)));
    expect(await mine('/community/popular?period=DAY&sort=COMMENTS')).toEqual([posts.p1, posts.p2]);
    expect(await mine('/community/popular?period=WEEK&sort=LIKES')).toEqual([posts.p2, posts.p1]);
    expect(await mine('/community/popular?period=MONTH&sort=LIKES&category=QUESTION')).toEqual([posts.p1]);
    const items = (await api(t, 'GET', '/community/popular?period=DAY&sort=COMMENTS')).body.items;
    expect(items.find((i: { id: number }) => i.id === posts.p1)).toMatchObject({ commentCount: 3, kind: 'COMMUNITY' });
    expect((await api(t, 'GET', '/community/popular?period=DAY&sort=VIEWS')).status).toBe(400);
  });

  it('수정: 작성자만, 요약 갱신, 태그 교체', async () => {
    const res = await api(t, 'PATCH', `/community/posts/${posts.p2}`, {
      token: a.token,
      body: { title: '바뀐 제목', body: '**바뀐** 본문이에요', tagIds: [tagIds[1], tagIds[2]] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: '바뀐 제목', summary: '바뀐 본문이에요', body: '**바뀐** 본문이에요' });
    expect(res.body.tags.map((tag: { id: number }) => tag.id)).toEqual([tagIds[1], tagIds[2]]);
    expect((await api(t, 'PATCH', `/community/posts/${posts.p2}`, { token: b.token, body: { title: '남의 글' } })).status).toBe(403);
    expect((await api(t, 'PATCH', `/community/posts/${posts.p2}`, { token: a.token, body: {} })).status).toBe(400);
  });

  it('신고: 1인 1회·자기 것 403, 3명이면 자동 숨김·점수 회수, 관리자 문제없음 처리 후 자동 숨김 제외', async () => {
    const report = (user: User | string, body: Record<string, unknown>) =>
      api(t, 'POST', '/reports', { token: typeof user === 'string' ? user : user.token, body });
    const target = { targetType: 'POST', targetId: posts.p3 };
    expect((await report(b, { ...target, reason: 'SPAM' })).status).toBe(201);
    expect((await report(b, { ...target, reason: 'ABUSE' })).body.code).toBe('REPORT_DUPLICATED');
    expect((await report(a, { ...target, reason: 'SPAM' })).body.code).toBe('REPORT_OWN_CONTENT');
    expect((await report(c, { ...target, reason: 'OTHER' })).status).toBe(400);
    expect((await report(c, { ...target, reason: 'SPAM', detail: '내용' })).status).toBe(400);
    expect((await report(c, { ...target, reason: 'OTHER', detail: '광고 같아요' })).status).toBe(201);
    expect((await api(t, 'GET', `/community/posts/${posts.p3}`, { token: b.token })).body).toMatchObject({ status: 'VISIBLE', reportedByMe: true });
    const before = await score(a);
    expect((await report(d, { ...target, reason: 'SPAM' })).status).toBe(201);
    expect((await score(a)) - before).toBe(-10);
    expect((await api(t, 'GET', `/community/posts/${posts.p3}`, { token: b.token })).status).toBe(404);
    expect((await api(t, 'GET', `/posts/${posts.p3}/comments`)).status).toBe(404);
    expect((await api(t, 'GET', `/community/posts/${posts.p3}`, { token: a.token })).body.status).toBe('HIDDEN');
    expect(await listIds('/community/posts?size=50')).not.toContain(posts.p3);
    expect((await api(t, 'PUT', `/posts/${posts.p3}/like`, { token: b.token })).body.code).toBe('COMMUNITY_POST_CLOSED');
    expect((await api(t, 'PUT', `/me/bookmarks/${posts.p3}`, { token: b.token })).body.code).toBe('COMMUNITY_POST_CLOSED');
    expect((await api(t, 'POST', `/posts/${posts.p3}/comments`, { token: b.token, body: { content: '댓글' } })).body.code).toBe(
      'COMMUNITY_POST_CLOSED',
    );
    expect((await api(t, 'PATCH', `/community/posts/${posts.p3}`, { token: a.token, body: { title: '숨김 수정' } })).body.code).toBe(
      'COMMUNITY_POST_CLOSED',
    );

    const queue = await api(t, 'GET', '/admin/reports?state=HIDDEN&size=50', { token: admin });
    const item = queue.body.items.find((i: { targetId: number; targetType: string }) => i.targetType === 'POST' && i.targetId === posts.p3);
    expect(item).toMatchObject({
      postId: posts.p3,
      state: 'HIDDEN',
      reportCount: 3,
      reasons: { SPAM: 2, ABUSE: 0, PRIVACY: 0, OTHER: 1 },
      details: ['광고 같아요'],
      preview: { title: '글 p3', author: { id: a.userId }, status: 'HIDDEN', hiddenReason: 'REPORTS' },
    });
    expect((await api(t, 'GET', '/admin/reports', { token: b.token })).status).toBe(403);
    const cleared = await api(t, 'PUT', `/admin/reports/POST/${posts.p3}`, { token: admin, body: { action: 'CLEAR' } });
    expect(cleared.body).toMatchObject({ state: 'CLEARED', preview: { status: 'VISIBLE', hiddenReason: null } });
    expect((await score(a)) - before).toBe(0);
    const extra = await signup(t, 'cm-e');
    await age(extra);
    expect((await report(extra, { ...target, reason: 'SPAM' })).status).toBe(201);
    expect((await api(t, 'GET', `/community/posts/${posts.p3}`)).body.status).toBe('VISIBLE');
    expect((await api(t, 'PUT', '/admin/reports/USER/1', { token: admin, body: { action: 'CLEAR' } })).status).toBe(400);
    await checks();
  });

  it('댓글 신고 3명: 자동 숨김, 채택 해제, 댓글 점수 회수', async () => {
    const before = await score(b);
    for (const user of [a, c, d]) {
      expect((await api(t, 'POST', '/reports', { token: user.token, body: { targetType: 'COMMENT', targetId: posts.cb, reason: 'ABUSE' } })).status).toBe(201);
    }
    expect((await score(b)) - before).toBe(-5);
    expect((await api(t, 'GET', `/community/posts/${posts.p1}`)).body).toMatchObject({ acceptedCommentId: null, community: { solved: false } });
    const list = await api(t, 'GET', `/posts/${posts.p1}/comments`, { token: c.token });
    expect(list.body.items.find((x: { id: number }) => x.id === posts.cb)).toMatchObject({ status: 'HIDDEN', reportedByMe: true });
    const queue = await api(t, 'GET', '/admin/reports?size=50', { token: admin });
    expect(queue.body.items.find((i: { targetId: number; targetType: string }) => i.targetType === 'COMMENT' && i.targetId === posts.cb)).toMatchObject({
      postId: posts.p1,
      state: 'HIDDEN',
      preview: { title: null, text: '답변이에요', hiddenReason: 'REPORTS' },
    });
    const hide = await api(t, 'DELETE', `/admin/comments/${posts.cb}/hidden`, { token: admin });
    expect(hide.status).toBe(200);
    expect((await score(b)) - before).toBe(0);
    await checks();
  });

  it('관리자 글 숨김·해제, 삭제: 댓글 없으면 404·있으면 자리, 목록·북마크에서 빠지고 받은 좋아요 회수', async () => {
    expect((await api(t, 'PUT', `/admin/community/posts/${posts.p4}/hidden`, { token: admin })).body.status).toBe('HIDDEN');
    expect((await api(t, 'GET', `/community/posts/${posts.p4}`)).status).toBe(404);
    expect((await api(t, 'DELETE', `/admin/community/posts/${posts.p4}/hidden`, { token: admin })).body.status).toBe('VISIBLE');

    expect((await api(t, 'PUT', `/me/bookmarks/${posts.p1}`, { token: b.token })).status).toBe(204);
    await api(t, 'PUT', `/posts/${posts.p1}/like`, { token: c.token });
    await api(t, 'POST', `/posts/${posts.p1}/views`, { token: b.token });
    const history = await api(t, 'GET', '/me/history', { token: b.token });
    expect(history.body.items.find((i: { id: number }) => i.id === posts.p1)).toMatchObject({ kind: 'COMMUNITY' });
    const before = await score(a);
    expect((await api(t, 'DELETE', `/community/posts/${posts.p1}`, { token: b.token })).status).toBe(403);
    expect((await api(t, 'DELETE', `/community/posts/${posts.p1}`, { token: a.token })).status).toBe(204);
    expect((await score(a)) - before).toBe(-10 - 1);
    const placeholder = await api(t, 'GET', `/community/posts/${posts.p1}`);
    expect(placeholder.body).toMatchObject({ status: 'DELETED', title: '', body: null, tags: [], community: { author: null } });
    expect((await api(t, 'DELETE', `/community/posts/${posts.p1}`, { token: a.token })).status).toBe(404);
    expect((await api(t, 'DELETE', `/community/posts/${posts.p5}`, { token: admin })).status).toBe(204);
    expect((await api(t, 'GET', `/community/posts/${posts.p5}`)).status).toBe(404);
    expect(await listIds('/community/posts?size=50')).not.toContain(posts.p1);
    const bookmarks = await api(t, 'GET', '/me/bookmarks', { token: b.token });
    expect(bookmarks.body.items.map((i: { id: number }) => i.id)).not.toContain(posts.p1);
    expect(bookmarks.body.total).toBe(0);
    expect(await listIds('/me/history', b.token)).not.toContain(posts.p1);
    expect((await api(t, 'POST', `/posts/${posts.p1}/views`, { token: b.token })).status).toBe(404);
    await checks();
  });

  it('탈퇴: 커뮤니티 글은 삭제 자리 규칙, 준 받은 좋아요 회수, 개인 데이터 0', async () => {
    await api(t, 'PUT', `/posts/${posts.p4}/like`, { token: c.token });
    const before = await score(a);
    const res = await api(t, 'POST', '/me/withdraw', { token: c.token, body: { password: c.password } });
    expect(res.status).toBe(204);
    expect((await score(a)) - before).toBe(-2);
    await comment(b, posts.p4, '탈퇴 전에 단 댓글');
    expect((await api(t, 'POST', '/me/withdraw', { token: a.token, body: { password: a.password } })).status).toBe(204);
    const residual = await residualPersonalData(t, a.userId);
    expect(Object.values(residual).every((n) => n === 0)).toBe(true);
    expect((await api(t, 'GET', `/community/posts/${posts.p4}`)).body).toMatchObject({ status: 'DELETED', community: { author: null } });
    expect((await api(t, 'GET', `/community/posts/${posts.p2}`)).body).toMatchObject({ status: 'DELETED', title: '' });
    await checks();
  });
});
