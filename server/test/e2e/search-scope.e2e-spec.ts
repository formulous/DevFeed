import { PostIngestService } from '../../src/crawl/post-ingest.service';
import { TagDictionaryService } from '../../src/crawl/tag-dictionary.service';
import { api, cleanup, communityMismatches, createFixtures, signup, startApp, TestApp } from './support/app';

describe('페이지별 검색 범위 (038)', () => {
  let t: TestApp;
  let admin = '';
  let tagName = '';
  let tagId = 0;
  const news: Record<string, number> = {};
  const posts: Record<string, number> = {};
  const word = () => `범위어${t.runId.replace(/[^a-z]/g, '').slice(0, 3) || 'abc'}`;

  const addNews = async (key: string, region: 'DOMESTIC' | 'OVERSEAS', title: string, summary: string) => {
    const s = (await t.db.query(
      "INSERT INTO sources (name, site_url, feed_url, source_type, kind, region) VALUES (?, ?, ?, 'COMPANY', 'SECURITY_NEWS', ?)",
      [`e2e ${t.runId} 뉴스 ${key}`, `https://e2e-${t.runId}.test/n${key}`, `https://e2e-${t.runId}.test/n${key}.xml`, region],
    )) as { insertId: number };
    const publishedAt = new Date();
    const r = (await t.db.query(
      "INSERT INTO posts (source_id, source_type, kind, url, title, summary, published_at) VALUES (?, 'COMPANY', 'SECURITY_NEWS', ?, ?, ?, ?)",
      [s.insertId, `https://e2e-${t.runId}.test/news/${key}`, title, summary, publishedAt],
    )) as { insertId: number };
    news[key] = Number(r.insertId);
    const loaded = await t.app.get(TagDictionaryService).get();
    await t.db.transaction((m) =>
      t.app.get(PostIngestService).reindex(m, { id: news[key], title, summary, publishedAt, kind: 'SECURITY_NEWS' }, `출처${key}`, loaded),
    );
  };

  const write = async (body: Record<string, unknown>) => {
    const res = await api(t, 'POST', '/community/posts', { token: admin, body });
    expect(res.status).toBe(201);
    return res.body.id as number;
  };

  const ids = async (query: string) => {
    const [q, ...rest] = query.split('&');
    const res = await api(t, 'GET', `/search?q=${encodeURIComponent(q)}${rest.map((r) => `&${r}`).join('')}`);
    expect(res.status).toBe(200);
    const mine = [...Object.values(news), ...Object.values(posts)];
    return (res.body.items as { id: number }[]).map((i) => i.id).filter((id) => mine.includes(id));
  };

  beforeAll(async () => {
    t = await startApp();
    const fx = await createFixtures(t, 0);
    tagId = fx.tagIds[0];
    [{ name: tagName }] = (await t.db.query('SELECT name FROM tags WHERE id = ?', [tagId])) as { name: string }[];
    const user = await signup(t, 'ss-admin');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id = ?", [user.userId]);
    admin = (await api(t, 'POST', '/auth/login', { body: { email: user.email, password: user.password } })).body.accessToken;
    await addNews('kr', 'DOMESTIC', `국내 취약점 패치 ${word()}`, '원격 코드 실행 취약점');
    await addNews('en', 'OVERSEAS', `해외 보고서 ${word()}`, '공급망 취약점 분석');
    posts.q = await write({ category: 'QUESTION', title: `모노레포 질문 ${word()}`, body: `# 제목\n\n- 빌드 캐시\n- **워크스페이스** 설정이 궁금해요`, tagIds: [tagId] });
    posts.s = await write({ category: 'SHARE', title: `공유 글 ${word()}`, body: `앞부분 ${'가'.repeat(2100)} 뒤쪽모노레포` });
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('보안 뉴스: 수집 색인으로 한글 부분 일치, 지역 필터, 기술 검색과 분리', async () => {
    expect(await ids(`취약점&scope=SECURITY`)).toEqual(expect.arrayContaining([news.kr, news.en]));
    expect(await ids(`취약점 ${word()}&scope=SECURITY&region=DOMESTIC`)).toEqual([news.kr]);
    expect(await ids(`출처en&scope=SECURITY`)).toEqual([news.en]);
    expect(await ids(`취약점 ${word()}`)).toEqual([]);
    const card = (await api(t, 'GET', `/search?q=${encodeURIComponent(`국내 취약점 ${word()}`)}&scope=SECURITY`)).body.items[0];
    expect(card).toMatchObject({ id: news.kr, kind: 'SECURITY_NEWS', thumbnailUrl: null });
  });

  it('자유 게시판: 제목·본문 앞 2,000자·태그, 말머리 필터, 기술·보안과 분리', async () => {
    expect(await ids(`모노레포 ${word()}&scope=COMMUNITY`)).toEqual([posts.q]);
    expect(await ids(`워크스페이스&scope=COMMUNITY`)).toEqual([posts.q]);
    expect(await ids(`${tagName}&scope=COMMUNITY`)).toContain(posts.q);
    expect(await ids(`뒤쪽모노레포&scope=COMMUNITY`)).toEqual([]);
    expect(await ids(`${word()}&scope=COMMUNITY&category=SHARE`)).toEqual([posts.s]);
    expect(await ids(`모노레포 ${word()}`)).toEqual([]);
    expect(await ids(`모노레포 ${word()}&scope=SECURITY`)).toEqual([]);
    const card = (await api(t, 'GET', `/search?q=${encodeURIComponent(`모노레포 질문 ${word()}`)}&scope=COMMUNITY`)).body.items[0];
    expect(card).toMatchObject({ id: posts.q, kind: 'COMMUNITY', community: { category: 'QUESTION' } });
    expect(card.summary).toContain('빌드 캐시');
  });

  it('자유 게시판: 수정 즉시 반영, 숨김 제외·해제 복구, 삭제는 색인 행 삭제', async () => {
    const patched = await api(t, 'PATCH', `/community/posts/${posts.q}`, { token: admin, body: { body: '쿠버네티스 배포 이야기로 바꿨어요' } });
    expect(patched.status).toBe(200);
    expect(await ids(`워크스페이스&scope=COMMUNITY`)).toEqual([]);
    expect(await ids(`쿠버네티스 배포&scope=COMMUNITY`)).toEqual([posts.q]);
    expect((await api(t, 'PUT', `/admin/community/posts/${posts.q}/hidden`, { token: admin })).status).toBeLessThan(300);
    expect(await ids(`쿠버네티스 배포&scope=COMMUNITY`)).toEqual([]);
    expect((await api(t, 'DELETE', `/admin/community/posts/${posts.q}/hidden`, { token: admin })).status).toBeLessThan(300);
    expect(await ids(`쿠버네티스 배포&scope=COMMUNITY`)).toEqual([posts.q]);
    expect((await api(t, 'DELETE', `/community/posts/${posts.s}`, { token: admin })).status).toBe(204);
    expect(await t.db.query('SELECT post_id FROM community_search WHERE post_id = ?', [posts.s])).toEqual([]);
    expect(await ids(`${word()}&scope=COMMUNITY&category=SHARE`)).toEqual([]);
    expect(Object.values(await communityMismatches(t)).every((n) => n === 0)).toBe(true);
  });

  it('범위 밖 필터·잘못된 범위는 400', async () => {
    for (const query of [
      'scope=SECURITY&tagIds=1',
      'scope=COMMUNITY&sourceIds=1',
      'scope=COMMUNITY&region=DOMESTIC',
      `scope=TECH&category=QUESTION`,
      'region=DOMESTIC',
      'scope=tech',
      'scope=SECURITY&region=KR',
    ]) {
      const res = await api(t, 'GET', `/search?q=${encodeURIComponent('취약점')}&${query}`);
      expect([query, res.status, res.body.code]).toEqual([query, 400, 'VALIDATION_FAILED']);
    }
  });
});
