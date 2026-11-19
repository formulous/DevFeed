import { MaintenanceService } from '../../src/crawl/maintenance.service';
import { uuidToBuffer } from '../../src/recommendations/snapshot';
import { api, cleanup, signup, startApp, TestApp } from './support/app';

const HOUR = 60 * 60 * 1000;

describe('F-042 추천: 콜드 스타트·개인화·다양성·노출/클릭 기록', () => {
  let t: TestApp;
  let tagIds: number[] = [];
  const posts: { id: number; source: number; tag: number }[] = [];

  beforeAll(async () => {
    t = await startApp();
    const sources: number[] = [];
    for (let s = 0; s < 3; s++) {
      const r = (await t.db.query(
        `INSERT INTO sources (name, site_url, feed_url, source_type) VALUES (?, ?, ?, 'COMPANY')`,
        [`e2e ${t.runId} ${s}`, `https://e2e-${t.runId}.test/${s}`, s === 0 ? `https://e2e-${t.runId}.test/feed.xml` : `https://e2e-${t.runId}.test/feed${s}.xml`],
      )) as { insertId: number };
      sources.push(Number(r.insertId));
    }
    for (let i = 0; i < 3; i++) {
      const r = (await t.db.query('INSERT INTO tags (name, slug) VALUES (?, ?)', [`E2E${t.runId}R${i}`, `e2e-${t.runId}-r${i}`])) as {
        insertId: number;
      };
      tagIds.push(Number(r.insertId));
    }
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      const source = i < 12 ? sources[0] : sources[1 + (i % 2)];
      const tag = i < 8 ? tagIds[0] : tagIds[1 + (i % 2)];
      const publishedAt = new Date(now - (i + 1) * HOUR);
      const r = (await t.db.query(
        `INSERT INTO posts (source_id, source_type, url, title, published_at, view_count) VALUES (?, 'COMPANY', ?, ?, ?, ?)`,
        [source, `https://e2e-${t.runId}.test/r/${i}`, `추천 ${i}`, publishedAt, 30 - i],
      )) as { insertId: number };
      posts.push({ id: Number(r.insertId), source, tag });
      await t.db.query('INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at) VALUES (?, ?, 1, ?)', [
        Number(r.insertId),
        tag,
        publishedAt,
      ]);
    }
  });

  afterAll(async () => {
    await t.db.query('DELETE FROM recommendation_daily_stats WHERE stat_date >= UTC_DATE() - INTERVAL 7 DAY');
    for (let s = 1; s < 3; s++) {
      const [row] = (await t.db.query('SELECT id FROM sources WHERE feed_url = ?', [`https://e2e-${t.runId}.test/feed${s}.xml`])) as { id: number }[];
      if (row) {
        await t.db.query('DELETE FROM recommendation_impressions WHERE post_id IN (SELECT id FROM posts WHERE source_id = ?)', [row.id]);
        await t.db.query('DELETE FROM post_view_guards WHERE post_id IN (SELECT id FROM posts WHERE source_id = ?)', [row.id]);
        await t.db.query('DELETE FROM posts WHERE source_id = ?', [row.id]);
        await t.db.query('DELETE FROM sources WHERE id = ?', [row.id]);
      }
    }
    await cleanup(t);
    await t.close();
  });

  const impressions = (userId: number) =>
    t.db.query('SELECT post_id, algorithm, position, reason, clicked_at FROM recommendation_impressions WHERE user_id = ? ORDER BY position', [userId]) as Promise<
      { post_id: number; algorithm: string; position: number; reason: string; clicked_at: Date | null }[]
    >;

  it('선호 데이터가 없으면 콜드 스타트: 조회수순, POPULAR, fallback true', async () => {
    const user = await signup(t, 'cold');
    const res = await api(t, 'GET', '/recommendations', { token: user.token });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.items).toHaveLength(20);
    expect(res.body.items[0].reasons).toEqual([{ type: 'POPULAR' }]);
    expect(res.body.recommendationId).toMatch(/^[0-9a-f-]{36}$/);
    const rows = await impressions(user.userId);
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((r) => r.algorithm))).toEqual(new Set(['COLD_POPULAR']));
    expect(rows.map((r) => r.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('관심 태그 저장 후 개인화: 이유·다양성·읽음/북마크 제외·20건 채움·커서', async () => {
    const user = await signup(t, 'personal');
    expect((await api(t, 'PUT', '/me/interest-tags', { token: user.token, body: { tagIds } })).status).toBe(200);
    await t.db.query('DELETE FROM user_interest_tags WHERE user_id = ? AND tag_id <> ?', [user.userId, tagIds[0]]);
    const tag0 = posts.filter((p) => p.tag === tagIds[0]);
    expect((await api(t, 'POST', `/posts/${tag0[0].id}/views`, { token: user.token })).status).toBe(204);
    expect((await api(t, 'PUT', `/me/bookmarks/${tag0[1].id}`, { token: user.token })).status).toBe(204);

    const first = await api(t, 'GET', '/recommendations?size=10', { token: user.token });
    expect(first.status).toBe(200);
    expect(first.body.fallback).toBe(false);
    const ids: number[] = first.body.items.map((i: { id: number }) => i.id);
    expect(ids).not.toContain(tag0[0].id);
    expect(ids).not.toContain(tag0[1].id);
    expect(first.body.items[0].reasons[0]).toEqual({ type: 'INTEREST_TAG', tagName: `E2E${t.runId}R0` });

    const second = await api(t, 'GET', `/recommendations?size=10&cursor=${encodeURIComponent(first.body.nextCursor)}`, { token: user.token });
    expect(second.status).toBe(200);
    expect(second.body.recommendationId).not.toBe(first.body.recommendationId);
    const all = [...first.body.items, ...second.body.items] as { id: number; source: { id: number }; reasons: { type: string }[] }[];
    expect(all).toHaveLength(20);
    expect(new Set(all.map((i) => i.id)).size).toBe(20);
    const personalized = all.filter((i) => i.reasons[0].type !== 'POPULAR');
    expect(personalized).toHaveLength(tag0.length - 2);
    expect(all[0].reasons[0].type).toBe('INTEREST_TAG');
    expect(new Set(personalized.map((i) => i.id))).toEqual(new Set(tag0.slice(2).map((p) => p.id)));
    for (let i = 2; i < all.length; i++) {
      const run = [all[i - 2], all[i - 1], all[i]].map((x) => x.source.id);
      const sameRun = run.every((s) => s === run[0]);
      const othersLeft = all.slice(i).some((x) => x.source.id !== run[0]);
      expect(sameRun && othersLeft).toBe(false);
    }

    const rows = await impressions(user.userId);
    expect(rows).toHaveLength(20);
    expect(rows.filter((r) => r.algorithm === 'TAG_V1')).toHaveLength(personalized.length);
    expect(rows[0].reason).toBe(`INTEREST_TAG:E2E${t.runId}R0`);

    const other = await signup(t, 'other');
    const foreign = await api(t, 'GET', `/recommendations?cursor=${encodeURIComponent(first.body.nextCursor)}`, { token: other.token });
    expect(foreign.status).toBe(400);
    expect(foreign.body.code).toBe('INVALID_CURSOR');

    const clicked = all[0].id;
    for (let k = 0; k < 2; k++) {
      expect((await api(t, 'POST', `/posts/${clicked}/views`, { token: user.token, body: { recommendationId: first.body.recommendationId } })).status).toBe(204);
    }
    expect((await api(t, 'POST', `/posts/${clicked}/views`, { token: other.token, body: { recommendationId: first.body.recommendationId } })).status).toBe(204);
    const after = await impressions(user.userId);
    expect(after.filter((r) => r.clicked_at !== null).map((r) => Number(r.post_id))).toEqual([clicked]);

    const [{ n }] = (await t.db.query('SELECT COUNT(*) n FROM recommendation_impressions WHERE request_id = ? AND clicked_at IS NOT NULL', [
      uuidToBuffer(first.body.recommendationId),
    ])) as { n: number | string }[];
    expect(Number(n)).toBe(1);

    const maintenance = t.app.get(MaintenanceService);
    await maintenance.recommendationStats(new Date());
    const stats = (await t.db.query(
      'SELECT algorithm, SUM(impression_count) imp, SUM(click_count) clk FROM recommendation_daily_stats WHERE stat_date >= UTC_DATE() - INTERVAL 1 DAY GROUP BY algorithm ORDER BY algorithm',
    )) as { algorithm: string; imp: number | string; clk: number | string }[];
    const byAlg = Object.fromEntries(stats.map((s) => [s.algorithm, [Number(s.imp), Number(s.clk)]]));
    expect(byAlg.TAG_V1[0]).toBeGreaterThanOrEqual(personalized.length);
    expect(byAlg.TAG_V1[1]).toBe(1);
    expect(byAlg.COLD_POPULAR[0]).toBeGreaterThanOrEqual(20);
  });

  it('비로그인 401', async () => {
    expect((await api(t, 'GET', '/recommendations')).status).toBe(401);
  });
});
