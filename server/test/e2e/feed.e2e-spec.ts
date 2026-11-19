import { api, cleanup, startApp, TestApp } from './support/app';

describe('피드 커서·필터 조합과 인기 글 (M2)', () => {
  let t: TestApp;
  const sources: number[] = [];
  const tags: number[] = [];
  const posts: { id: number; source: number; type: 'COMPANY' | 'PERSONAL'; tags: number[]; at: number }[] = [];

  beforeAll(async () => {
    t = await startApp();
    for (let s = 0; s < 3; s++) {
      const type = s === 2 ? 'PERSONAL' : 'COMPANY';
      const r = (await t.db.query('INSERT INTO sources (name, site_url, feed_url, source_type) VALUES (?, ?, ?, ?)', [
        `e2e ${t.runId} f${s}`,
        `https://e2e-${t.runId}.test/f${s}`,
        s === 0 ? `https://e2e-${t.runId}.test/feed.xml` : `https://e2e-${t.runId}.test/f${s}.xml`,
        type,
      ])) as { insertId: number };
      sources.push(Number(r.insertId));
    }
    for (let i = 0; i < 3; i++) {
      const r = (await t.db.query('INSERT INTO tags (name, slug) VALUES (?, ?)', [`E2E${t.runId}F${i}`, `e2e-${t.runId}-f${i}`])) as { insertId: number };
      tags.push(Number(r.insertId));
    }
    const base = Date.UTC(2026, 9, 1);
    for (let i = 0; i < 37; i++) {
      const sourceIndex = i % 3;
      const at = base + Math.floor(i / 2) * 3_600_000;
      const postTags = [tags[i % 3], ...(i % 4 === 0 ? [tags[(i + 1) % 3]] : [])];
      const r = (await t.db.query(
        'INSERT INTO posts (source_id, source_type, url, title, published_at, view_count) VALUES (?, ?, ?, ?, ?, ?)',
        [sources[sourceIndex], sourceIndex === 2 ? 'PERSONAL' : 'COMPANY', `https://e2e-${t.runId}.test/feed/${i}`, `피드 ${i}`, new Date(at), i % 5],
      )) as { insertId: number };
      const id = Number(r.insertId);
      for (const [rank, tagId] of postTags.entries()) {
        await t.db.query('INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at) VALUES (?, ?, ?, ?)', [id, tagId, rank + 1, new Date(at)]);
      }
      posts.push({ id, source: sources[sourceIndex], type: sourceIndex === 2 ? 'PERSONAL' : 'COMPANY', tags: postTags, at });
    }
  });

  afterAll(async () => {
    for (let s = 1; s < 3; s++) {
      await t.db.query('DELETE FROM posts WHERE source_id = ?', [sources[s]]);
      await t.db.query('DELETE FROM sources WHERE id = ?', [sources[s]]);
    }
    await cleanup(t);
    await t.close();
  });

  const expected = (filter: (p: (typeof posts)[number]) => boolean) =>
    posts.filter(filter).sort((a, b) => b.at - a.at || b.id - a.id).map((p) => p.id);

  const scroll = async (query: string) => {
    const ids: number[] = [];
    let cursor: string | null = null;
    do {
      const res = await api(t, 'GET', `/posts?size=4&${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      expect(res.status).toBe(200);
      ids.push(...res.body.items.map((i: { id: number }) => i.id));
      cursor = res.body.nextCursor;
    } while (cursor);
    return ids;
  };

  const ours = (p: (typeof posts)[number]) => sources.includes(p.source);

  it.each([
    ['소스 3개 (UNION ALL)', () => `sourceIds=${sources.join(',')}`, (p: (typeof posts)[number]) => ours(p)],
    ['소스 1개', () => `sourceIds=${sources[0]}`, (p: (typeof posts)[number]) => p.source === sources[0]],
    ['소스 유형 + 소스', () => `sourceIds=${sources.join(',')}&sourceType=PERSONAL`, (p: (typeof posts)[number]) => p.type === 'PERSONAL'],
    ['태그 1개', () => `tagIds=${tags[0]}`, (p: (typeof posts)[number]) => p.tags.includes(tags[0])],
    ['태그 2개 (UNION 중복 제거)', () => `tagIds=${tags[0]},${tags[1]}`, (p: (typeof posts)[number]) => p.tags.includes(tags[0]) || p.tags.includes(tags[1])],
    ['태그 2개 + 유형', () => `tagIds=${tags[0]},${tags[1]}&sourceType=COMPANY`, (p: (typeof posts)[number]) => p.type === 'COMPANY' && (p.tags.includes(tags[0]) || p.tags.includes(tags[1]))],
    ['태그 + 소스 2개', () => `tagIds=${tags[2]}&sourceIds=${sources[0]},${sources[2]}`, (p: (typeof posts)[number]) => p.tags.includes(tags[2]) && (p.source === sources[0] || p.source === sources[2])],
  ])('%s: 끝까지 스크롤한 결과가 기대 순서와 일치, 중복·누락 없음', async (_name, query, filter) => {
    const got = await scroll(query());
    expect(got).toEqual(expected(filter));
  });

  it('스크롤 중 새 글이 들어와도 중복·누락 없음', async () => {
    const first = await api(t, 'GET', `/posts?size=5&sourceIds=${sources.join(',')}`);
    await t.db.query('INSERT INTO posts (source_id, source_type, url, title, published_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))', [
      sources[0],
      'COMPANY',
      `https://e2e-${t.runId}.test/feed/new`,
      '새 글',
    ]);
    const ids = first.body.items.map((i: { id: number }) => i.id);
    let cursor = first.body.nextCursor;
    while (cursor) {
      const res = await api(t, 'GET', `/posts?size=5&sourceIds=${sources.join(',')}&cursor=${encodeURIComponent(cursor)}`);
      ids.push(...res.body.items.map((i: { id: number }) => i.id));
      cursor = res.body.nextCursor;
    }
    expect(ids).toEqual(expected(ours));
  });

  it('잘못된 커서·필터 값은 400', async () => {
    expect((await api(t, 'GET', '/posts?cursor=zzz')).body.code).toBe('INVALID_CURSOR');
    expect((await api(t, 'GET', '/posts?tagIds=1,a')).body.code).toBe('VALIDATION_FAILED');
    expect((await api(t, 'GET', `/posts?tagIds=${Array.from({ length: 11 }, (_, i) => i + 1).join(',')}`)).status).toBe(400);
  });

  it('인기 글은 조회수 1 이상만, 조회수 내림차순·동점 최신순 (008)', async () => {
    const now = Date.now();
    const recent = posts.slice(0, 6);
    for (const [i, p] of recent.entries()) {
      await t.db.query('UPDATE posts SET published_at = ?, view_count = ? WHERE id = ?', [new Date(now - (i + 1) * 60_000), [3, 0, 5, 5, 1, 0][i], p.id]);
    }
    const res = await api(t, 'GET', '/posts/popular?period=DAY');
    expect(res.status).toBe(200);
    const mine = res.body.items.filter((i: { id: number }) => recent.some((p) => p.id === i.id));
    expect(mine.map((i: { viewCount: number }) => i.viewCount)).toEqual([5, 5, 3, 1]);
    expect(mine[0].id).toBe(recent[2].id);
  });
});
