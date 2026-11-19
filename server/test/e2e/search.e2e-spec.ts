import { toTokenString } from '../../src/ingest/tokenizer';
import { api, cleanup, createFixtures, startApp, TestApp } from './support/app';

describe('검색 (M3): 한글 bigram 구문 매칭·필터·정렬·건수 상한', () => {
  let t: TestApp;
  let fx: Awaited<ReturnType<typeof createFixtures>>;
  const ids: Record<string, number> = {};
  const word = () => `검증어${t.runId.replace(/[^a-z]/g, '').slice(0, 3) || 'abc'}`;

  const addPost = async (key: string, title: string, summary: string, publishedAt: Date, tagId?: number) => {
    const r = (await t.db.query(
      "INSERT INTO posts (source_id, source_type, url, title, summary, published_at) VALUES (?, 'COMPANY', ?, ?, ?, ?)",
      [fx.sourceId, `https://e2e-${t.runId}.test/s/${key}`, title, summary, publishedAt],
    )) as { insertId: number };
    const id = Number(r.insertId);
    await t.db.query('INSERT INTO post_search (post_id, title_tokens, body_tokens) VALUES (?, ?, ?)', [
      id,
      toTokenString(title),
      toTokenString(summary),
    ]);
    if (tagId) await t.db.query('INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at) VALUES (?, ?, 1, ?)', [id, tagId, publishedAt]);
    ids[key] = id;
  };

  beforeAll(async () => {
    t = await startApp();
    fx = await createFixtures(t, 0);
    const now = Date.now();
    await addPost('title', `카프카 컨슈머 리밸런싱이 줄어든 이유 ${word()}`, '운영 기록', new Date(now - 3 * 86_400_000), fx.tagIds[0]);
    await addPost('body', `운영 회고 ${word()}`, '컨슈머 그룹 리밸런싱을 줄이는 설정', new Date(now - 1 * 86_400_000));
    await addPost('old', `오래된 리밸런싱 정리 ${word()}`, '예전 글', new Date(now - 400 * 86_400_000));
    await addPost('scrambled', `런싱 밸런 리밸 ${word()}`, '순서가 뒤섞인 토큰', new Date(now - 2 * 86_400_000));
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  const search = async (query: string) => {
    const res = await api(t, 'GET', `/search?${query}`);
    expect(res.status).toBe(200);
    return res.body as { items: { id: number }[]; total: number; totalCapped: boolean; page: number; size: number };
  };
  const q = (text: string) => `q=${encodeURIComponent(`${text} ${word()}`)}`;

  it('조사가 붙은 단어도 찾고, bigram 순서가 뒤섞인 글은 제외함 (구문 매칭)', async () => {
    const res = await search(q('리밸런싱'));
    expect(new Set(res.items.map((i) => i.id))).toEqual(new Set([ids.title, ids.body, ids.old]));
    expect(res.items.map((i) => i.id)).not.toContain(ids.scrambled);
    expect(res).toMatchObject({ total: 3, totalCapped: false, page: 1, size: 20 });
  });

  it('관련도순은 제목 일치 글이 본문만 일치하는 글보다 위, 최신순은 발행일 역순', async () => {
    const relevance = (await search(q('리밸런싱'))).items.map((i) => i.id);
    expect(new Set(relevance.slice(0, 2))).toEqual(new Set([ids.title, ids.old]));
    expect(relevance[2]).toBe(ids.body);
    expect((await search(`${q('리밸런싱')}&sort=LATEST`)).items.map((i) => i.id)).toEqual([ids.body, ids.title, ids.old]);
  });

  it('기간·태그·소스 필터', async () => {
    expect((await search(`${q('리밸런싱')}&period=1Y`)).items.map((i) => i.id).sort()).toEqual([ids.title, ids.body].sort());
    expect((await search(`${q('리밸런싱')}&tagIds=${fx.tagIds[0]}`)).items.map((i) => i.id)).toEqual([ids.title]);
    expect((await search(`${q('리밸런싱')}&sourceIds=999999`)).total).toBe(0);
  });

  it('토큰이 남지 않는 검색어는 0건, 길이 검증', async () => {
    expect(await search(`q=${encodeURIComponent('가 나 a')}`)).toMatchObject({ items: [], total: 0, totalCapped: false });
    expect((await api(t, 'GET', '/search?q=a')).body.fieldErrors[0].field).toBe('q');
    expect((await api(t, 'GET', `/search?q=${'가'.repeat(51)}`)).status).toBe(400);
    expect((await api(t, 'GET', `/search?${q('리밸런싱')}&page=51`)).status).toBe(400);
  });

  it('1,000건 초과는 total 1000 + totalCapped (010)', async () => {
    const bulk = `대량${word()}`;
    await t.db.query(
      `INSERT INTO posts (source_id, source_type, url, title, published_at)
       WITH d (v) AS (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)
       SELECT ?, 'COMPANY', CONCAT(?, n), ?, '2026-01-01'
         FROM (SELECT a.v + b.v * 10 + c.v * 100 + e.v * 1000 + 1 AS n FROM d a, d b, d c, d e) seq WHERE n <= 1005`,
      [fx.sourceId, `https://e2e-${t.runId}.test/bulk/`, bulk],
    );
    await t.db.query(
      `INSERT INTO post_search (post_id, title_tokens, body_tokens)
       SELECT id, ?, '' FROM posts WHERE source_id = ? AND url LIKE ?`,
      [toTokenString(bulk), fx.sourceId, `https://e2e-${t.runId}.test/bulk/%`],
    );
    const res = await search(`q=${encodeURIComponent(bulk)}&page=50`);
    expect(res).toMatchObject({ total: 1000, totalCapped: true, page: 50 });
    expect(res.items).toHaveLength(20);
  });
});
