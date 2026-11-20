import { toTokenString } from '../../src/ingest/tokenizer';
import { api, cleanup, createFixtures, signup, startApp, TestApp } from './support/app';

const HANGUL = '가나다라마바사아자차카타파하거너';

describe('태그 영어화: 한글 이름을 동의어로 남기면 태깅·검색·분야 결과가 같음 (023)', () => {
  let t: TestApp;
  let admin = '';
  let tagId = 0;
  let fx: Awaited<ReturnType<typeof createFixtures>>;
  const postIds: Record<string, number> = {};
  const korean = () => `캐시${[...t.runId].map((c) => HANGUL[parseInt(c, 16)]).join('')}`;

  const addPost = async (key: string, title: string, summary: string, feedCategories: string | null, at: Date) => {
    const r = (await t.db.query(
      "INSERT INTO posts (source_id, source_type, url, title, summary, published_at) VALUES (?, 'COMPANY', ?, ?, ?, ?)",
      [fx.sourceId, `https://e2e-${t.runId}.test/en/${key}`, title, summary, at],
    )) as { insertId: number };
    const id = Number(r.insertId);
    await t.db.query('INSERT INTO post_search (post_id, title_tokens, body_tokens, feed_categories) VALUES (?, ?, ?, ?)', [
      id,
      toTokenString(title),
      toTokenString(summary),
      feedCategories,
    ]);
    postIds[key] = id;
  };

  const retag = async () => {
    const job = await api(t, 'POST', '/admin/tags/retag', { token: admin });
    expect(job.status).toBe(202);
    let state = '';
    for (let i = 0; i < 80 && state !== 'SUCCEEDED'; i++) {
      state = (await api(t, 'GET', `/admin/jobs/${job.body.jobId}`, { token: admin })).body.status;
      if (state !== 'SUCCEEDED') await new Promise((r) => setTimeout(r, 250));
    }
    expect(state).toBe('SUCCEEDED');
  };

  const snapshot = async () => {
    const tagged = (await t.db.query('SELECT post_id FROM post_tags WHERE tag_id = ? ORDER BY post_id', [tagId])) as { post_id: number }[];
    const search = await api(t, 'GET', `/search?q=${encodeURIComponent(korean())}&sort=LATEST`);
    expect(search.status).toBe(200);
    return {
      tagged: tagged.map((r) => Number(r.post_id)),
      search: search.body.items.map((i: { id: number }) => i.id) as number[],
    };
  };

  beforeAll(async () => {
    t = await startApp();
    fx = await createFixtures(t, 0);
    const a = await signup(t, 'admin');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id = ?", [a.userId]);
    admin = (await api(t, 'POST', '/auth/login', { body: { email: a.email, password: a.password } })).body.accessToken;
    const created = await api(t, 'POST', '/admin/tags', {
      token: admin,
      body: { name: korean(), slug: `e2e-${t.runId}-cache`, category: 'Language' },
    });
    expect(created.status).toBe(201);
    tagId = created.body.id;
    const now = Date.now();
    await addPost('title', `${korean()} 무효화 전략`, '운영 기록', null, new Date(now - 3_600_000));
    await addPost('category', '레디스 운영기', '만료 정책 정리', korean(), new Date(now - 2 * 3_600_000));
    await addPost('none', '관계없는 글', '다른 주제', null, new Date(now - 3 * 3_600_000));
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('이름을 영어로 바꾸고 한글 이름을 동의어로 남긴 뒤 재태깅해도 태그 글·검색 결과가 같음', async () => {
    await retag();
    const before = await snapshot();
    expect(before.tagged).toEqual([postIds.title, postIds.category].sort((a, b) => a - b));
    expect(before.search).toEqual([postIds.title, postIds.category]);

    const patched = await api(t, 'PATCH', `/admin/tags/${tagId}`, {
      token: admin,
      body: { name: `E2E Cache ${t.runId}`, synonyms: [korean()], category: 'Backend' },
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ id: tagId, name: `E2E Cache ${t.runId}`, synonyms: [korean()], category: 'Backend' });

    await retag();
    expect(await snapshot()).toEqual(before);
    const english = await api(t, 'GET', `/search?q=${encodeURIComponent(`Cache ${t.runId}`)}&sort=LATEST`);
    expect(english.body.items.map((i: { id: number }) => i.id)).toEqual([postIds.title, postIds.category]);
  });

  it('분류를 분야에 묶인 영어 값으로 바꾸면 분야 탭에 나옴', async () => {
    const res = await api(t, 'GET', `/posts?field=BACKEND&tagIds=${tagId}&size=10`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([postIds.title, postIds.category]);
  });
});
