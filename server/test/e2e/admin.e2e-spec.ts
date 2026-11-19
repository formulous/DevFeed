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
    feed = createServer((_req, res) => {
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
    const rows = (await t.db.query('SELECT id FROM sources WHERE feed_url = ?', [feedUrl])) as { id: number }[];
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
