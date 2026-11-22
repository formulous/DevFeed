import { api, cleanup, signup, startApp, TestApp } from './support/app';

type Kind = 'BLOG' | 'SECURITY_NEWS';

describe('분야 필터·보안 뉴스 분리 (021)', () => {
  let t: TestApp;
  const src: Record<'blog' | 'personal' | 'domestic' | 'overseas', number> = { blog: 0, personal: 0, domestic: 0, overseas: 0 };
  const tag: Record<'security' | 'backend' | 'lang', number> = { security: 0, backend: 0, lang: 0 };
  const post: Record<string, number> = {};
  const now = Date.now();

  const addSource = async (key: keyof typeof src, type: string, kind: Kind, region: string | null) => {
    const r = (await t.db.query(
      'INSERT INTO sources (name, site_url, feed_url, source_type, kind, region) VALUES (?, ?, ?, ?, ?, ?)',
      [`e2e ${t.runId} ${key}`, `https://e2e-${t.runId}.test/${key}`, `https://e2e-${t.runId}.test/${key}.xml`, type, kind, region],
    )) as { insertId: number };
    src[key] = Number(r.insertId);
  };

  const addPost = async (key: string, sourceKey: keyof typeof src, minutesAgo: number, tags: number[], views = 0) => {
    const kind: Kind = sourceKey === 'domestic' || sourceKey === 'overseas' ? 'SECURITY_NEWS' : 'BLOG';
    const at = new Date(now - minutesAgo * 60_000);
    const r = (await t.db.query(
      'INSERT INTO posts (source_id, source_type, kind, url, title, published_at, view_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [src[sourceKey], sourceKey === 'personal' ? 'PERSONAL' : 'COMPANY', kind, `https://e2e-${t.runId}.test/p/${key}`, `글 ${key}`, at, views],
    )) as { insertId: number };
    post[key] = Number(r.insertId);
    for (const [i, tagId] of tags.entries()) {
      await t.db.query('INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at, kind) VALUES (?, ?, ?, ?, ?)', [post[key], tagId, i + 1, at, kind]);
    }
  };

  beforeAll(async () => {
    t = await startApp();
    await addSource('blog', 'COMPANY', 'BLOG', null);
    await addSource('personal', 'PERSONAL', 'BLOG', null);
    await addSource('domestic', 'COMPANY', 'SECURITY_NEWS', 'DOMESTIC');
    await addSource('overseas', 'COMPANY', 'SECURITY_NEWS', 'OVERSEAS');
    for (const [key, category] of [['security', 'Security'], ['backend', 'Architecture'], ['lang', 'Language']] as const) {
      const r = (await t.db.query('INSERT INTO tags (name, slug, category) VALUES (?, ?, ?)', [
        `E2E${t.runId}${key}`,
        `e2e-${t.runId}-${key}`,
        category,
      ])) as { insertId: number };
      tag[key] = Number(r.insertId);
    }
    await addPost('b1', 'blog', 10, [tag.security], 5);
    await addPost('b2', 'blog', 20, [tag.backend, tag.lang], 1);
    await addPost('p1', 'personal', 30, [tag.lang, tag.security]);
    await addPost('n1', 'domestic', 1, [tag.security], 50);
    await addPost('n2', 'overseas', 2, [tag.security], 40);
    await addPost('n3', 'domestic', 3, []);
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  const ids = (body: { items: { id: number }[] }) => body.items.map((i) => i.id).filter((id) => Object.values(post).includes(id));
  const news = () => [post.n1, post.n2, post.n3];

  it('최신·유형·인기·추천 응답에 보안 뉴스가 없음', async () => {
    expect(ids((await api(t, 'GET', '/posts?size=50')).body)).toEqual([post.b1, post.b2, post.p1]);
    expect(ids((await api(t, 'GET', '/posts?sourceType=COMPANY&size=50')).body)).toEqual([post.b1, post.b2]);
    expect(ids((await api(t, 'GET', `/posts?tagIds=${tag.security}`)).body)).toEqual([post.b1, post.p1]);
    expect((await api(t, 'GET', `/posts?sourceIds=${src.domestic}`)).body).toEqual({ items: [], nextCursor: null });
    const popular = await api(t, 'GET', '/posts/popular?period=DAY');
    expect(ids(popular.body)).toEqual([post.b1, post.b2]);
    const user = await signup(t, 'rec');
    const rec = await api(t, 'GET', '/recommendations?size=50', { token: user.token });
    expect(ids(rec.body).some((id) => news().includes(id))).toBe(false);
  });

  it('분야: 분류 묶음 태그 글만, 다른 필터와 AND, 묶이지 않는 분류는 제외', async () => {
    expect(ids((await api(t, 'GET', '/posts?field=SECURITY')).body)).toEqual([post.b1, post.p1]);
    expect(ids((await api(t, 'GET', '/posts?field=BACKEND')).body)).toEqual([post.b2]);
    expect(ids((await api(t, 'GET', '/posts?field=SECURITY&sourceType=PERSONAL')).body)).toEqual([post.p1]);
    expect(ids((await api(t, 'GET', `/posts?field=SECURITY&tagIds=${tag.lang}`)).body)).toEqual([post.p1]);
    expect(ids((await api(t, 'GET', `/posts?field=BACKEND&sourceIds=${src.blog},${src.personal}`)).body)).toEqual([post.b2]);
    expect(ids((await api(t, 'GET', '/posts/popular?period=DAY&field=BACKEND')).body)).toEqual([post.b2]);
    const bad = await api(t, 'GET', '/posts?field=backend');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
  });

  it('보안 뉴스 목록: 최신순 커서, 지역·출처 필터, 블로그 출처는 0건', async () => {
    const first = await api(t, 'GET', '/security-news?size=2');
    expect(ids(first.body)).toEqual([post.n1, post.n2]);
    expect(first.body.items.every((i: { thumbnailUrl: null; isPopular: boolean }) => i.thumbnailUrl === null && i.isPopular === false)).toBe(true);
    const next = await api(t, 'GET', `/security-news?size=2&cursor=${encodeURIComponent(first.body.nextCursor)}`);
    expect(ids(next.body)).toEqual([post.n3]);
    expect(ids((await api(t, 'GET', '/security-news?region=DOMESTIC')).body)).toEqual([post.n1, post.n3]);
    expect(ids((await api(t, 'GET', `/security-news?region=OVERSEAS&sourceIds=${src.domestic}`)).body)).toEqual([]);
    expect(ids((await api(t, 'GET', `/security-news?sourceIds=${src.overseas},${src.blog}`)).body)).toEqual([post.n2]);
    expect((await api(t, 'GET', `/security-news?sourceIds=${src.blog}`)).body.items).toEqual([]);
    expect((await api(t, 'GET', '/security-news?region=KR')).status).toBe(400);
  });

  it('보안 뉴스 인기: 조회수순, 조회 0건 제외, 지역 필터, 기술 인기와 분리 (031)', async () => {
    const all = await api(t, 'GET', '/security-news/popular?period=DAY');
    expect(all.status).toBe(200);
    expect(ids(all.body)).toEqual([post.n1, post.n2]);
    const n1 = all.body.items.find((i: { id: number }) => i.id === post.n1);
    expect(n1).toMatchObject({ viewCount: 50, thumbnailUrl: null, isPopular: false });
    expect(ids((await api(t, 'GET', '/security-news/popular?period=WEEK&region=DOMESTIC')).body)).toEqual([post.n1]);
    expect(ids((await api(t, 'GET', '/security-news/popular?period=MONTH&region=OVERSEAS')).body)).toEqual([post.n2]);
    expect(ids((await api(t, 'GET', '/posts/popular?period=DAY')).body)).toEqual([post.b1, post.b2]);
    const user = await signup(t, 'secpop');
    const authed = await api(t, 'GET', '/security-news/popular?period=DAY', { token: user.token });
    expect(authed.body.items.find((i: { id: number }) => i.id === post.n1)).toMatchObject({ isBookmarked: false, isRead: false, likedByMe: false });
    expect((await api(t, 'GET', '/security-news/popular')).status).toBe(400);
    expect((await api(t, 'GET', '/security-news/popular?period=DAY&region=KR')).status).toBe(400);
    expect((await api(t, 'GET', `/security-news/popular?period=DAY&sourceIds=${src.domestic}`)).status).toBe(400);
  });

  it('출처 목록은 국내 → 해외, /sources와 태그 글 수에는 뉴스 제외', async () => {
    const sources = await api(t, 'GET', '/security-news/sources');
    const mine = sources.body.items.filter((s: { id: number }) => s.id === src.domestic || s.id === src.overseas);
    expect(mine).toEqual([
      { id: src.domestic, name: `e2e ${t.runId} domestic`, logoUrl: null, region: 'DOMESTIC' },
      { id: src.overseas, name: `e2e ${t.runId} overseas`, logoUrl: null, region: 'OVERSEAS' },
    ]);
    const blogSources = (await api(t, 'GET', '/sources')).body.items.map((s: { id: number }) => s.id);
    expect(blogSources).toEqual(expect.arrayContaining([src.blog, src.personal]));
    expect(blogSources).not.toContain(src.domestic);
    const tags = await api(t, 'GET', `/tags?q=${encodeURIComponent(`E2E${t.runId}security`)}`);
    expect(tags.body.items[0].postCount).toBe(2);
  });

  it('북마크·읽은 기록은 보안 뉴스도 허용', async () => {
    const user = await signup(t, 'news');
    expect((await api(t, 'PUT', `/me/bookmarks/${post.n1}`, { token: user.token })).status).toBeLessThan(300);
    expect((await api(t, 'POST', `/posts/${post.n2}/views`, { token: user.token })).status).toBe(204);
    expect(ids((await api(t, 'GET', '/me/bookmarks', { token: user.token })).body)).toEqual([post.n1]);
    const news = await api(t, 'GET', '/security-news', { token: user.token });
    const n1 = news.body.items.find((i: { id: number }) => i.id === post.n1);
    expect(n1).toMatchObject({ isBookmarked: true });
    expect(news.body.items.find((i: { id: number }) => i.id === post.n2)).toMatchObject({ isRead: true });
  });
});
