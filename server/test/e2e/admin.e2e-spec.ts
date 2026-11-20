import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { api, cleanup, signup, startApp, TestApp } from './support/app';

type Mode = 'ok' | 'html' | '500';

describe('관리자 API: 소스·수집·태그 사전·재태깅·권한', () => {
  let t: TestApp;
  let feed: Server;
  let feedUrl = '';
  let mode: Mode = 'ok';
  let admin = '';
  let user = '';
  const tagName = () => `E2E${t.runId}쿠버`;

  beforeAll(async () => {
    t = await startApp();
    feed = createServer((req, res) => {
      if (req.url?.startsWith('/news')) {
        res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' }).end(
          `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>E2E News</title>
           <item><title>랜섬웨어 경보 ${t.runId}</title><link>http://127.0.0.1/n/1</link><guid>e2e-n-1</guid>
             <pubDate><![CDATA[ 2026-11-18 ]]></pubDate><media:thumbnail url="https://img.e2e.test/n1.png"/>
             <description>${'보안 '.repeat(200)}</description><category>e2ecat-${t.runId}</category></item>
           </channel></rss>`,
        );
        return;
      }
      if (mode === '500') {
        res.writeHead(500).end('boom');
        return;
      }
      if (mode === 'html') {
        res.writeHead(200, { 'content-type': 'text/html' }).end('<html><body>not feed</body></html>');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' }).end(
        `<?xml version="1.0"?><rss version="2.0"><channel><title>E2E Feed</title><link>http://127.0.0.1/</link>
         <item><title>운영 회고</title><link>http://127.0.0.1/p/1?utm_source=rss</link><guid>e2e-1</guid>
           <pubDate>Wed, 18 Nov 2026 00:00:00 GMT</pubDate><description>&lt;p&gt;요약&lt;/p&gt;</description>
           <category>e2ecat-${t.runId}</category></item>
         <item><title>두 번째 글</title><link>http://127.0.0.1/p/2</link><guid>e2e-2</guid>
           <pubDate>Tue, 17 Nov 2026 00:00:00 GMT</pubDate></item>
         </channel></rss>`,
      );
    });
    await new Promise<void>((resolve) => feed.listen(0, '127.0.0.1', resolve));
    feedUrl = `http://127.0.0.1:${(feed.address() as AddressInfo).port}/feed.xml`;

    const a = await signup(t, 'admin');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id = ?", [a.userId]);
    admin = (await api(t, 'POST', '/auth/login', { body: { email: a.email, password: a.password } })).body.accessToken;
    user = (await signup(t, 'plain')).token;
  });

  afterAll(async () => {
    const origin = feedUrl.replace('/feed.xml', '');
    const rows = (await t.db.query('SELECT id FROM sources WHERE feed_url LIKE ?', [`${origin}/%`])) as { id: number }[];
    for (const { id } of rows) {
      await t.db.query('DELETE FROM posts WHERE source_id = ?', [id]);
      await t.db.query('DELETE FROM crawl_runs WHERE source_id = ?', [id]);
      await t.db.query('DELETE FROM sources WHERE id = ?', [id]);
    }
    await cleanup(t);
    await new Promise((resolve) => feed.close(resolve));
    await t.close();
  });

  const waitRun = async (sourceId: number) => {
    for (let i = 0; i < 60; i++) {
      const runs = await api(t, 'GET', `/admin/sources/${sourceId}/runs?size=1`, { token: admin });
      if (runs.body.items[0]?.result !== 'RUNNING') return runs.body.items[0];
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('수집이 끝나지 않음');
  };

  it('권한: 토큰 없음 401, 일반 회원 403', async () => {
    expect((await api(t, 'GET', '/admin/stats')).status).toBe(401);
    const forbidden = await api(t, 'GET', '/admin/stats', { token: user });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });

  it('소스 검증·등록·중복·수집·상태 전환', async () => {
    const tag = await api(t, 'POST', '/admin/tags', {
      token: admin,
      body: { name: tagName(), slug: `e2e-${t.runId}-k8s`, category: '인프라', synonyms: [`e2ecat-${t.runId}`] },
    });
    expect(tag.status).toBe(201);

    mode = 'html';
    const invalid = await api(t, 'POST', '/admin/sources/validate', { token: admin, body: { feedUrl } });
    expect(invalid.body).toMatchObject({ valid: false, duplicated: false });
    const rejected = await api(t, 'POST', '/admin/sources', {
      token: admin,
      body: { name: 'E2E 소스', siteUrl: 'http://127.0.0.1', feedUrl, type: 'PERSONAL', crawlIntervalMin: 30 },
    });
    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe('SOURCE_FEED_INVALID');

    mode = 'ok';
    const valid = await api(t, 'POST', '/admin/sources/validate', { token: admin, body: { feedUrl } });
    expect(valid.body).toMatchObject({ valid: true, format: 'RSS', feedTitle: 'E2E Feed', itemCount: 2 });
    const created = await api(t, 'POST', '/admin/sources', {
      token: admin,
      body: { name: 'E2E 소스', siteUrl: 'http://127.0.0.1', feedUrl, type: 'PERSONAL', crawlIntervalMin: 30 },
    });
    expect(created.status).toBe(201);
    const sourceId = created.body.id as number;
    expect(created.body).toMatchObject({ status: 'ACTIVE', consecutiveFailures: 0, lastSuccessAt: null });
    const dup = await api(t, 'POST', '/admin/sources', {
      token: admin,
      body: { name: '중복', siteUrl: 'http://127.0.0.1', feedUrl, type: 'PERSONAL' },
    });
    expect(dup.body.code).toBe('SOURCE_FEED_DUPLICATED');

    const crawl = await api(t, 'POST', `/admin/sources/${sourceId}/crawl`, { token: admin });
    expect(crawl.status).toBe(202);
    const run = await waitRun(sourceId);
    expect(run).toMatchObject({ triggerType: 'MANUAL', result: 'SUCCESS', fetchedCount: 2, newPostCount: 2 });
    const posts = (await t.db.query(
      `SELECT p.url, ps.feed_categories, GROUP_CONCAT(tg.name) AS tags
         FROM posts p JOIN post_search ps ON ps.post_id = p.id
         LEFT JOIN post_tags pt ON pt.post_id = p.id LEFT JOIN tags tg ON tg.id = pt.tag_id
        WHERE p.source_id = ? GROUP BY p.id ORDER BY p.published_at DESC`,
      [sourceId],
    )) as { url: string; feed_categories: string | null; tags: string | null }[];
    expect(posts[0]).toEqual({ url: 'http://127.0.0.1/p/1', feed_categories: `e2ecat-${t.runId}`, tags: tagName() });

    expect((await api(t, 'POST', `/admin/sources/${sourceId}/crawl`, { token: admin })).status).toBe(202);
    const again = await waitRun(sourceId);
    expect(again.newPostCount).toBe(0);
    const [{ n }] = (await t.db.query('SELECT COUNT(*) n FROM posts WHERE source_id = ?', [sourceId])) as { n: number | string }[];
    expect(Number(n)).toBe(2);

    mode = '500';
    await api(t, 'POST', `/admin/sources/${sourceId}/crawl`, { token: admin });
    const failed = await waitRun(sourceId);
    expect(failed).toMatchObject({ result: 'FAILURE', httpStatus: 500, attemptCount: 4, errorMessage: 'HTTP 500' });
    const detail = await api(t, 'GET', `/admin/sources/${sourceId}`, { token: admin });
    expect(detail.body).toMatchObject({ status: 'ACTIVE', consecutiveFailures: 1 });

    expect((await api(t, 'POST', `/admin/sources/${sourceId}/resume`, { token: admin })).body.code).toBe('SOURCE_NOT_IN_ERROR');
    const inactive = await api(t, 'PATCH', `/admin/sources/${sourceId}`, { token: admin, body: { status: 'INACTIVE' } });
    expect(inactive.body.status).toBe('INACTIVE');
    expect((await api(t, 'POST', `/admin/sources/${sourceId}/crawl`, { token: admin })).body.code).toBe('SOURCE_INACTIVE');
    const listed = await api(t, 'GET', '/admin/sources?status=INACTIVE', { token: admin });
    expect(listed.body.items.map((s: { id: number }) => s.id)).toContain(sourceId);

    const stats = await api(t, 'GET', '/admin/stats', { token: admin });
    expect(stats.body.todayNewPostCount).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it('보안 뉴스 소스: 종류·지역 검증, 수집 시 뉴스 규칙 적용 (021)', async () => {
    const newsUrl = feedUrl.replace('/feed.xml', '/news.xml');
    const base = { name: `E2E 뉴스 ${t.runId}`, siteUrl: 'http://127.0.0.1/', feedUrl: newsUrl };
    const noRegion = await api(t, 'POST', '/admin/sources', { token: admin, body: { ...base, kind: 'SECURITY_NEWS' } });
    expect(noRegion.status).toBe(400);
    expect(noRegion.body.fieldErrors[0].field).toBe('region');
    const blogRegion = await api(t, 'POST', '/admin/sources', { token: admin, body: { ...base, type: 'COMPANY', region: 'DOMESTIC' } });
    expect(blogRegion.status).toBe(400);

    const created = await api(t, 'POST', '/admin/sources', { token: admin, body: { ...base, kind: 'SECURITY_NEWS', region: 'DOMESTIC' } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ kind: 'SECURITY_NEWS', region: 'DOMESTIC', type: 'COMPANY' });
    const id = created.body.id;

    expect((await api(t, 'PATCH', `/admin/sources/${id}`, { token: admin, body: { kind: 'BLOG' } })).status).toBe(400);
    expect((await api(t, 'PATCH', `/admin/sources/${id}`, { token: admin, body: { type: 'PERSONAL' } })).status).toBe(400);
    const moved = await api(t, 'PATCH', `/admin/sources/${id}`, { token: admin, body: { region: 'OVERSEAS' } });
    expect(moved.body.region).toBe('OVERSEAS');
    const listed = await api(t, 'GET', '/admin/sources?kind=SECURITY_NEWS', { token: admin });
    expect(listed.body.items.every((s: { kind: string }) => s.kind === 'SECURITY_NEWS')).toBe(true);
    expect(listed.body.items.some((s: { id: number }) => s.id === id)).toBe(true);

    await api(t, 'POST', `/admin/sources/${id}/crawl`, { token: admin });
    expect((await waitRun(id)).result).toBe('SUCCESS');
    const [post] = (await t.db.query(
      'SELECT id, kind, thumbnail_url, CHAR_LENGTH(summary) AS len, published_at FROM posts WHERE source_id = ?',
      [id],
    )) as { id: number; kind: string; thumbnail_url: string | null; len: number; published_at: Date }[];
    expect(post).toMatchObject({ kind: 'SECURITY_NEWS', thumbnail_url: null });
    expect(Number(post.len)).toBeLessThanOrEqual(150);
    expect(post.published_at.toISOString()).toBe('2026-11-17T15:00:00.000Z');
    expect(await t.db.query('SELECT 1 FROM post_search WHERE post_id = ?', [post.id])).toHaveLength(0);
    const tags = (await t.db.query('SELECT kind FROM post_tags WHERE post_id = ?', [post.id])) as { kind: string }[];
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every((r) => r.kind === 'SECURITY_NEWS')).toBe(true);
  });

  it('태그 사전: 중복·동의어 충돌·수정·재태깅 작업', async () => {
    const dup = await api(t, 'POST', '/admin/tags', { token: admin, body: { name: tagName(), slug: `e2e-${t.runId}-other` } });
    expect(dup.body.code).toBe('TAG_DUPLICATED');
    const synonym = await api(t, 'POST', '/admin/tags', {
      token: admin,
      body: { name: `E2E${t.runId}다른`, slug: `e2e-${t.runId}-x`, synonyms: [`e2ecat-${t.runId}`] },
    });
    expect(synonym.body.code).toBe('SYNONYM_DUPLICATED');

    const list = await api(t, 'GET', `/admin/tags?q=${encodeURIComponent(`e2ecat-${t.runId}`)}`, { token: admin });
    expect(list.body.items).toHaveLength(1);
    const tagId = list.body.items[0].id as number;
    const patched = await api(t, 'PATCH', `/admin/tags/${tagId}`, { token: admin, body: { category: null, synonyms: ['e2e-only-synonym'] } });
    expect(patched.body).toMatchObject({ category: null, synonyms: ['e2e-only-synonym'] });

    const job = await api(t, 'POST', '/admin/tags/retag', { token: admin });
    expect(job.status).toBe(202);
    let state = '';
    for (let i = 0; i < 40 && state !== 'SUCCEEDED'; i++) {
      state = (await api(t, 'GET', `/admin/jobs/${job.body.jobId}`, { token: admin })).body.status;
      if (state !== 'SUCCEEDED') await new Promise((r) => setTimeout(r, 250));
    }
    expect(state).toBe('SUCCEEDED');
    expect((await api(t, 'GET', '/admin/jobs/00000000-0000-4000-8000-000000000000', { token: admin })).status).toBe(404);
  });
});
