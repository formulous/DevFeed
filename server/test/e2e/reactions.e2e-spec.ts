import { api, cleanup, createFixtures, reactionMismatches, residualPersonalData, signup, startApp, TestApp } from './support/app';

type User = Awaited<ReturnType<typeof signup>>;

describe('좋아요·댓글 (M8, 026)', () => {
  let t: TestApp;
  let fx: Awaited<ReturnType<typeof createFixtures>>;
  let admin = '';
  let a: User;
  let b: User;
  let c: User;
  let postId = 0;
  let otherPostId = 0;

  const comments = async (path: string, token?: string) => {
    const res = await api(t, 'GET', path, { token });
    expect(res.status).toBe(200);
    return res.body;
  };
  const write = (user: User, content: string, parentId?: number, post = postId) =>
    api(t, 'POST', `/posts/${post}/comments`, { token: user.token, body: { content, parentId } });
  const counts = async () => {
    const [row] = (await t.db.query('SELECT like_count, comment_count FROM posts WHERE id = ?', [postId])) as {
      like_count: number;
      comment_count: number;
    }[];
    return { like: Number(row.like_count), comment: Number(row.comment_count) };
  };

  beforeAll(async () => {
    t = await startApp();
    fx = await createFixtures(t, 2);
    [postId, otherPostId] = fx.postIds;
    const adminUser = await signup(t, 'radmin');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id = ?", [adminUser.userId]);
    admin = (await api(t, 'POST', '/auth/login', { body: { email: adminUser.email, password: adminUser.password } })).body.accessToken;
    a = await signup(t, 'ra');
    b = await signup(t, 'rb');
    c = await signup(t, 'rc');
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('좋아요: 게스트 401·없는 글 404, 동시 20개 요청 후에도 수와 likedByMe 일치, 카드에 반영', async () => {
    expect((await api(t, 'PUT', `/posts/${postId}/like`)).status).toBe(401);
    expect((await api(t, 'PUT', '/posts/999999999/like', { token: a.token })).status).toBe(404);

    const mixed = await Promise.all(
      Array.from({ length: 20 }, (_, i) => api(t, i % 2 ? 'DELETE' : 'PUT', `/posts/${postId}/like`, { token: a.token })),
    );
    expect(mixed.filter((r) => r.status !== 200).map((r) => [r.status, r.body])).toEqual([]);
    const [{ n }] = (await t.db.query('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?', [postId])) as { n: number }[];
    expect((await counts()).like).toBe(Number(n));
    expect([0, 1]).toContain(Number(n));

    const on = await Promise.all(Array.from({ length: 20 }, () => api(t, 'PUT', `/posts/${postId}/like`, { token: a.token })));
    expect(on.every((r) => r.body.liked === true)).toBe(true);
    expect(await counts()).toMatchObject({ like: 1 });
    expect((await api(t, 'PUT', `/posts/${postId}/like`, { token: b.token })).body).toEqual({ liked: true, likeCount: 2 });
    expect((await api(t, 'DELETE', `/posts/${postId}/like`, { token: b.token })).body).toEqual({ liked: false, likeCount: 1 });
    expect((await api(t, 'DELETE', `/posts/${postId}/like`, { token: b.token })).body).toEqual({ liked: false, likeCount: 1 });

    const feed = `/posts?sourceIds=${fx.sourceId}`;
    const member = (await api(t, 'GET', feed, { token: a.token })).body.items.find((i: { id: number }) => i.id === postId);
    expect(member).toMatchObject({ likeCount: 1, commentCount: 0, likedByMe: true });
    const guest = (await api(t, 'GET', feed)).body.items.find((i: { id: number }) => i.id === postId);
    expect(guest).toMatchObject({ likeCount: 1, likedByMe: false });
    expect(guest).not.toHaveProperty('isBookmarked');
  });

  it('작성 검증: 공백만·1,001자 400, 원문 그대로 저장, 답글의 답글은 최상위로, 다른 글·없는 부모 404, 게스트 401', async () => {
    expect((await write(a, '   ')).status).toBe(400);
    expect((await write(a, 'ㄱ'.repeat(1001))).status).toBe(400);
    expect((await api(t, 'POST', `/posts/${postId}/comments`, { body: { content: '게스트' } })).status).toBe(401);

    const top = await write(a, '  <script>alert(1)</script>\n둘째 줄  ');
    expect(top.status).toBe(201);
    expect(top.body.comment).toMatchObject({ content: '<script>alert(1)</script>\n둘째 줄', parentId: null, mine: true, status: 'VISIBLE' });
    expect(top.body.commentCount).toBe(1);
    const topId = top.body.comment.id;

    const reply = await write(b, '답글', topId);
    const nested = await write(c, '답글의 답글', reply.body.comment.id);
    expect(nested.body.comment.parentId).toBe(topId);
    expect(nested.body.commentCount).toBe(3);
    expect((await write(b, '다른 글 부모', topId, otherPostId)).status).toBe(404);
    expect((await write(b, '없는 부모', 999999999)).status).toBe(404);
    expect(await reactionMismatches(t)).toEqual(Object.fromEntries(Object.keys(await reactionMismatches(t)).map((k) => [k, 0])));
  });

  it('목록: 오래된 순 커서, 답글 3개 + repliesNextCursor로 이어 받기, 게스트 읽기 가능', async () => {
    const first = await comments(`/posts/${postId}/comments`);
    const topId = first.items[0].id;
    await write(b, '답글 3', topId);
    await write(b, '답글 4', topId);
    await write(c, '두 번째 댓글');

    const page1 = await comments(`/posts/${postId}/comments?size=1`);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]).toMatchObject({ id: topId, replyCount: 4, mine: false });
    expect(page1.items[0].replies.map((r: { content: string }) => r.content)).toEqual(['답글', '답글의 답글', '답글 3']);
    expect(page1.items[0].replies[0].author.nickname).toBe('테스터rb');
    const more = await comments(`/comments/${topId}/replies?cursor=${page1.items[0].repliesNextCursor}`);
    expect(more.items.map((r: { content: string }) => r.content)).toEqual(['답글 4']);
    expect(more.nextCursor).toBeNull();
    const page2 = await comments(`/posts/${postId}/comments?size=1&cursor=${page1.nextCursor}`);
    expect(page2.items[0]).toMatchObject({ content: '두 번째 댓글', replies: [], repliesNextCursor: null });
    expect(page2.nextCursor).toBeNull();
    expect((await api(t, 'GET', `/comments/${page1.items[0].replies[0].id}/replies`)).status).toBe(404);
    expect((await api(t, 'GET', '/posts/999999999/comments')).status).toBe(404);
    expect((await api(t, 'GET', `/posts/${postId}/comments?cursor=zzz`)).body.code).toBe('INVALID_CURSOR');
  });

  it('수정: 본인만, editedAt 기록 / 숨김: 관리자만, 수 감소·멱등·내용 가림, 숨긴 댓글 수정 409', async () => {
    const [top] = (await comments(`/posts/${postId}/comments`)).items;
    expect((await api(t, 'PATCH', `/comments/${top.id}`, { token: b.token, body: { content: '남의 댓글' } })).status).toBe(403);
    const edited = await api(t, 'PATCH', `/comments/${top.id}`, { token: a.token, body: { content: ' 고친 내용 ' } });
    expect(edited.body).toMatchObject({ content: '고친 내용', mine: true });
    expect(edited.body.editedAt).not.toBeNull();

    const before = (await counts()).comment;
    expect((await api(t, 'PUT', `/admin/comments/${top.id}/hidden`, { token: a.token })).status).toBe(403);
    const hidden = await api(t, 'PUT', `/admin/comments/${top.id}/hidden`, { token: admin });
    expect(hidden.body).toMatchObject({ comment: { status: 'HIDDEN', content: '고친 내용' }, commentCount: before - 1 });
    expect((await api(t, 'PUT', `/admin/comments/${top.id}/hidden`, { token: admin })).body.commentCount).toBe(before - 1);
    const guestView = (await comments(`/posts/${postId}/comments`)).items[0];
    expect(guestView).toMatchObject({ status: 'HIDDEN', content: null, author: null });
    expect((await comments(`/posts/${postId}/comments`, a.token)).items[0]).toMatchObject({ content: null, mine: true });
    expect((await comments(`/posts/${postId}/comments`, admin)).items[0].content).toBe('고친 내용');
    expect((await api(t, 'PATCH', `/comments/${top.id}`, { token: a.token, body: { content: '다시' } })).body.code).toBe('COMMENT_HIDDEN');

    const shown = await api(t, 'DELETE', `/admin/comments/${top.id}/hidden`, { token: admin });
    expect(shown.body).toMatchObject({ comment: { status: 'VISIBLE' }, commentCount: before });
    expect((await api(t, 'DELETE', `/admin/comments/${top.id}/hidden`, { token: admin })).body.commentCount).toBe(before);
  });

  it('삭제: 답글 있으면 자리 표시, 마지막 답글 삭제 시 자리 표시도 정리, 없으면 완전 삭제', async () => {
    const [top, second] = (await comments(`/posts/${postId}/comments`)).items;
    expect((await api(t, 'DELETE', `/comments/${top.id}`, { token: b.token })).status).toBe(403);
    const placeholder = await api(t, 'DELETE', `/comments/${top.id}`, { token: a.token });
    expect(placeholder.body).toMatchObject({ removed: false, parentRemoved: false });
    const listed = (await comments(`/posts/${postId}/comments`)).items[0];
    expect(listed).toMatchObject({ id: top.id, status: 'DELETED', content: null, author: null, replyCount: 4 });
    expect((await api(t, 'DELETE', `/comments/${top.id}`, { token: a.token })).status).toBe(404);
    expect((await write(b, '자리 표시에 답글', top.id)).status).toBe(404);

    const replies = (await comments(`/comments/${top.id}/replies?size=10`)).items as { id: number; author: { id: number } }[];
    let last: { removed: boolean; parentRemoved: boolean; commentCount: number } | undefined;
    for (const reply of replies) {
      const owner = [a, b, c].find((u) => u.userId === reply.author.id)!;
      last = (await api(t, 'DELETE', `/comments/${reply.id}`, { token: owner.token })).body;
    }
    expect(last).toMatchObject({ removed: true, parentRemoved: true });
    const remaining = (await comments(`/posts/${postId}/comments`)).items;
    expect(remaining.map((i: { id: number }) => i.id)).toEqual([second.id]);
    const gone = await api(t, 'DELETE', `/comments/${second.id}`, { token: c.token });
    expect(gone.body).toEqual({ commentCount: 0, removed: true, parentRemoved: false });
    expect((await counts()).comment).toBe(0);
    expect(Object.values(await reactionMismatches(t)).every((v) => v === 0)).toBe(true);
  });

  it('속도 제한: 1분 5개 초과 시 429·retryAfterSec·Retry-After', async () => {
    const d = await signup(t, 'rd');
    for (let i = 0; i < 5; i++) expect((await write(d, `연속 ${i}`, undefined, otherPostId)).status).toBe(201);
    const res = await fetch(`${t.base}/posts/${otherPostId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${d.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '여섯 번째' }),
    });
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe('COMMENT_RATE_LIMITED');
    expect(body.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(body.retryAfterSec).toBeLessThanOrEqual(60);
    expect(res.headers.get('retry-after')).toBe(String(body.retryAfterSec));
  });

  it('탈퇴: 좋아요·댓글 내용 0건, 남의 답글이 달린 댓글은 자리 표시, 수 일치', async () => {
    const w = await signup(t, 'rw');
    await api(t, 'PUT', `/posts/${postId}/like`, { token: w.token });
    await api(t, 'PUT', `/posts/${otherPostId}/like`, { token: w.token });
    const withReplies = (await write(w, '탈퇴할 사람 댓글')).body.comment.id;
    await write(b, '남의 답글', withReplies);
    await write(w, '혼자 댓글');
    const others = (await write(c, '남의 댓글')).body.comment.id;
    await write(w, '남의 댓글에 답글', others);
    const hiddenOwn = (await write(w, '숨겨질 댓글')).body.comment.id;
    await api(t, 'PUT', `/admin/comments/${hiddenOwn}/hidden`, { token: admin });

    expect((await api(t, 'POST', '/me/withdraw', { token: w.token, body: { password: w.password } })).status).toBe(204);
    expect(await residualPersonalData(t, w.userId)).toMatchObject({ post_likes: 0, comments: 0, users: 0 });
    const list = (await comments(`/posts/${postId}/comments`)).items as { id: number; status: string; replyCount: number }[];
    expect(list.find((i) => i.id === withReplies)).toMatchObject({ status: 'DELETED', replyCount: 1 });
    expect(list.find((i) => i.id === others)).toMatchObject({ status: 'VISIBLE', replyCount: 0 });
    expect(list.some((i) => i.id === hiddenOwn)).toBe(false);
    expect(await counts()).toEqual({ like: 1, comment: 2 });
    expect(Object.values(await reactionMismatches(t)).every((v) => v === 0)).toBe(true);
  });
});
