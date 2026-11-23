import { api, cleanup, signup, startApp, TestApp } from './support/app';

describe('sitemap·RSS (044)', () => {
  let t: TestApp;
  let web = '';
  const posts: Record<string, number> = {};
  const base = () => process.env.WEB_BASE_URL || 'http://localhost:5175';

  const get = async (path: string) => {
    const res = await fetch(`${web}${path}`);
    return { status: res.status, type: res.headers.get('content-type') ?? '', cache: res.headers.get('cache-control'), text: await res.text() };
  };

  beforeAll(async () => {
    t = await startApp();
    web = t.base.replace(/\/api$/, '');
    const user = await signup(t, 'feeds', 'pass1234');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id = ?", [user.userId]);
    const token = (await api(t, 'POST', '/auth/login', { body: { email: user.email, password: user.password } })).body.accessToken;
    for (const [key, category, title] of [
      ['visible', 'QUESTION', `피드 <질문> & ${t.runId}`],
      ['edited', 'SHARE', `피드 공유 ${t.runId}`],
      ['hidden', 'DISCUSSION', `피드 숨김 ${t.runId}`],
      ['deleted', 'DISCUSSION', `피드 삭제 ${t.runId}`],
    ]) {
      const res = await api(t, 'POST', '/community/posts', { token, body: { category, title, body: `**본문** ${key}`, tagIds: [] } });
      expect(res.status).toBe(201);
      posts[key] = res.body.id;
    }
    await t.db.query("UPDATE community_posts SET edited_at = '2026-11-20 01:02:03.000' WHERE post_id = ?", [posts.edited]);
    await t.db.query("UPDATE community_posts SET status = 'HIDDEN', hidden_at = NOW(3), hidden_reason = 'ADMIN' WHERE post_id = ?", [posts.hidden]);
    expect((await api(t, 'DELETE', `/community/posts/${posts.deleted}`, { token })).status).toBeLessThan(300);
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('sitemap: 고정 화면 4개 + 공개 글만, lastmod는 수정 시각 우선, /api 밖 경로', async () => {
    const res = await get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/xml; charset=utf-8');
    expect(res.cache).toBe('public, max-age=600');
    for (const path of ['/tech', '/security', '/community', '/privacy']) expect(res.text).toContain(`<url><loc>${base()}${path}</loc></url>`);
    expect(res.text).not.toContain('/tech/popular');
    expect(res.text).toContain(`<loc>${base()}/community/posts/${posts.visible}</loc><lastmod>`);
    expect(res.text).toMatch(new RegExp(`/community/posts/${posts.edited}</loc><lastmod>2026-11-\\d\\dT\\d\\d:02:03.000Z</lastmod>`));
    expect(res.text).not.toContain(`/community/posts/${posts.hidden}<`);
    expect(res.text).not.toContain(`/community/posts/${posts.deleted}<`);
    expect((await get('/sitemap-1.xml')).text).toBe(res.text);
    expect((await get('/sitemap-2.xml')).status).toBe(404);
    expect((await get('/sitemap-0.xml')).status).toBe(404);
    expect((await get('/sitemap-a.xml')).status).toBe(404);
    expect((await get('/api/sitemap.xml')).status).toBe(404);
  });

  it('RSS: 공개 글 최신순, 이스케이프·말머리·작성자', async () => {
    const res = await get('/community/rss.xml');
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/rss+xml; charset=utf-8');
    expect(res.text).toContain(`<title>피드 &lt;질문&gt; &amp; ${t.runId}</title>`);
    expect(res.text).toContain(`<guid isPermaLink="true">${base()}/community/posts/${posts.visible}</guid>`);
    expect(res.text).toContain('<category>질문</category>');
    expect(res.text).toContain('<dc:creator>테스터feeds</dc:creator>');
    expect(res.text).toContain('<description>본문 visible</description>');
    expect(res.text.indexOf(`/community/posts/${posts.edited}<`)).toBeLessThan(res.text.indexOf(`/community/posts/${posts.visible}<`));
    expect(res.text).not.toContain(`피드 숨김 ${t.runId}`);
    expect(res.text).not.toContain(`피드 삭제 ${t.runId}`);
    expect(res.text.match(/<item>/g)!.length).toBeLessThanOrEqual(50);
  });
});
