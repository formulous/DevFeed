import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { api, cleanup, signup, startApp, TestApp } from './support/app';

const ROUTES = {
  version: 1,
  origin: 'https://site.test',
  siteName: 'formulous',
  defaultTitle: '기본 제목',
  defaultDescription: '기본 설명',
  routes: [
    { pattern: '/', title: '최신 기술 글 · formulous', description: '홈', robots: 'noindex, follow', canonical: '/tech' },
    { pattern: '/tech', title: '최신 기술 글 · formulous', description: '기술', robots: 'index, follow', canonical: '/tech' },
    { pattern: '/tech/comments', title: '댓글 많은 기술 글 · formulous', description: '댓글', robots: 'index, follow', canonical: '/tech' },
    { pattern: '/community', title: '자유 게시판 · formulous', description: '자유', robots: 'index, follow', canonical: '/community' },
    { pattern: '/community/new', title: '글쓰기 · formulous', description: '쓰기', robots: 'noindex, nofollow', canonical: '/community/new' },
    { pattern: '/community/posts/:id', title: '글 · formulous', description: '글', robots: 'index, follow', canonical: '/community/posts/:id', dynamic: true },
    { pattern: '/search', title: '검색 · formulous', description: '검색', robots: 'noindex, follow', canonical: '/search' },
  ],
  notFound: { pattern: '*', title: '페이지를 찾을 수 없어요 · formulous', description: '없음', robots: 'noindex, follow', canonical: '' },
};

const TEMPLATE = `<!doctype html><html><head>
    <!--seo:head-->
    <title data-seo="title">기본 제목</title>
    <!--/seo:head-->
    <script type="module" src="/assets/index-abc.js"></script>
  </head><body><div id="root"><!--seo:body--></div></body></html>`;

describe('HTML 머리말·본문 주입 (044 S3~S7)', () => {
  let t: TestApp;
  let web = '';
  let dir = '';
  const posts: Record<string, number> = {};
  let accepted = 0;

  const page = async (path: string) => {
    const res = await fetch(`${web}${path}`);
    const html = await res.text();
    const head = html.slice(html.indexOf('<!--seo:head-->'), html.indexOf('<!--/seo:head-->'));
    const root = html.slice(html.indexOf('<div id="root">') + 15, html.indexOf('</div></body>'));
    const json = (id: string) => {
      const m = new RegExp(`<script type="application/(?:ld\\+)?json"[^>]*${id}[^>]*>(.*?)</script>`).exec(head);
      return m ? JSON.parse(m[1]) : undefined;
    };
    return { status: res.status, type: res.headers.get('content-type'), cache: res.headers.get('cache-control'), cookie: res.headers.get('set-cookie'), html, head, root, json };
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'web-pages-'));
    writeFileSync(join(dir, 'index.html'), TEMPLATE);
    writeFileSync(join(dir, 'routes.json'), JSON.stringify(ROUTES));
    process.env.WEB_DIST_DIR = dir;
    t = await startApp();
    web = t.base.replace(/\/api$/, '');
    const a = await signup(t, 'pga');
    const b = await signup(t, 'pgb');
    await t.db.query("UPDATE users SET role = 'ADMIN' WHERE id IN (?, ?)", [a.userId, b.userId]);
    const login = async (u: { email: string; password: string }) =>
      (await api(t, 'POST', '/auth/login', { body: { email: u.email, password: u.password } })).body.accessToken as string;
    const [ta, tb] = [await login(a), await login(b)];
    const write = async (key: string, category: string, title: string, body: string) => {
      const res = await api(t, 'POST', '/community/posts', { token: ta, body: { category, title, body, tagIds: [] } });
      expect(res.status).toBe(201);
      posts[key] = res.body.id;
    };
    await write('qa', 'QUESTION', `질문 "<script>alert(1)</script>" ${t.runId}`, '# 큰 제목\n\n**굵게** [링크](https://ok.test) [나쁜](javascript:alert(1))\n\n<img src=x onerror=alert(1)>\n\n</script><script>alert(2)</script>');
    await write('talk', 'DISCUSSION', `토론 ${t.runId}`, '토론 본문이에요. 의견 나눠요.');
    await write('hidden', 'DISCUSSION', `숨김 ${t.runId}`, '숨김 본문이에요. 보이면 안 돼요.');
    const c1 = await api(t, 'POST', `/posts/${posts.qa}/comments`, { token: tb, body: { content: '<b>답</b> 이에요' } });
    accepted = c1.body.comment.id;
    await api(t, 'POST', `/posts/${posts.qa}/comments`, { token: tb, body: { content: '두 번째 댓글' } });
    expect((await api(t, 'PUT', `/community/posts/${posts.qa}/accepted-comment`, { token: ta, body: { commentId: accepted } })).status).toBe(200);
    await t.db.query("UPDATE community_posts SET status = 'HIDDEN', hidden_at = NOW(3), hidden_reason = 'ADMIN' WHERE post_id = ?", [posts.hidden]);
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
    delete process.env.WEB_DIST_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('글 상세: 머리말·이스케이프·canonical·article·본문 무해화·댓글, 쿠키 없음', async () => {
    const p = await page(`/community/posts/${posts.qa}?ref=x`);
    expect(p.status).toBe(200);
    expect(p.type).toBe('text/html; charset=utf-8');
    expect(p.cache).toBe('public, max-age=60');
    expect(p.cookie).toBeNull();
    expect(p.head).toContain(`<title data-seo="title">질문 &quot;&lt;script&gt;alert(1)&lt;/script&gt;&quot; ${t.runId} · formulous</title>`);
    expect(p.head).toContain(`<link rel="canonical" href="https://site.test/community/posts/${posts.qa}" data-seo="canonical" />`);
    expect(p.head).toContain('content="article" data-seo="og:type"');
    expect(p.head).toContain('data-seo="article:author"');
    expect(p.head).not.toContain('기본 제목');
    expect(p.html).toContain('<script type="module" src="/assets/index-abc.js"></script>');
    expect(p.html.match(/<script(?![^>]*(type="module"|application\/(ld\+)?json))/g)).toBeNull();
    expect(p.root).toContain('<h2>큰 제목</h2>');
    expect(p.root).toContain('<a href="https://ok.test" target="_blank" rel="nofollow ugc noopener noreferrer">링크</a>');
    expect(p.root).not.toMatch(/javascript:|<img|<[^>]*\sonerror=/);
    expect(p.root).toContain('&lt;b&gt;답&lt;/b&gt; 이에요');
    expect(p.root).toContain('채택된 답변');
    expect(p.root).toContain('두 번째 댓글');
  });

  it('JSON-LD: 채택 질문은 QAPage, 그 외 DiscussionForumPosting / seo-data는 상세 API 비로그인 응답과 같음', async () => {
    const qa = await page(`/community/posts/${posts.qa}`);
    const ld = qa.json('jsonld');
    expect(ld['@type']).toBe('QAPage');
    expect(ld.mainEntity.acceptedAnswer).toMatchObject({ '@type': 'Answer', text: '<b>답</b> 이에요' });
    expect(ld.mainEntity.suggestedAnswer).toHaveLength(1);
    expect(ld.mainEntity.answerCount).toBe(2);
    const detail = (await api(t, 'GET', `/community/posts/${posts.qa}`)).body;
    expect(qa.json('seo-data')).toEqual(detail);
    const talk = (await page(`/community/posts/${posts.talk}`)).json('jsonld');
    expect(talk).toMatchObject({ '@type': 'DiscussionForumPosting', headline: `토론 ${t.runId}`, commentCount: 0, url: `https://site.test/community/posts/${posts.talk}` });
  });

  it('404: 없는 글·숨김·숫자 아님·경로 표에 없는 경로 / 정렬 화면 canonical 기본 목록 / 목록 본문', async () => {
    for (const path of [`/community/posts/${posts.hidden}`, '/community/posts/999999999999', '/community/posts/abc', '/nope/deep']) {
      const p = await page(path);
      expect(p.status).toBe(404);
      expect(p.head).toContain('content="noindex, follow" data-seo="robots"');
      expect(p.head).not.toContain('canonical');
      expect(p.root).toBe('');
    }
    expect((await page('/nope/deep')).head).toContain('<title data-seo="title">페이지를 찾을 수 없어요 · formulous</title>');
    expect((await page('/community/posts/abc')).head).toContain('글을 찾을 수 없어요');
    expect((await page(`/community/posts/${posts.hidden}`)).head).toContain('<title data-seo="title">글을 찾을 수 없어요 · formulous</title>');
    const sorted = await page('/tech/comments?field=backend');
    expect(sorted.status).toBe(200);
    expect(sorted.head).toContain('href="https://site.test/tech" data-seo="canonical"');
    expect(sorted.root).toBe('');
    expect((await page('/community/new')).head).toContain('content="noindex, nofollow"');
    expect((await page('/tech/')).status).toBe(200);
    const list = await page('/community');
    expect(list.root).toContain(`<a href="/community/posts/${posts.talk}">토론 ${t.runId}</a>`);
    expect(list.root).not.toContain(`숨김 ${t.runId}`);
    expect((await fetch(`${web}/api/health`)).status).toBe(200);
    expect((await fetch(`${web}/assets/none.js`)).status).toBe(404);
  });

  it('틀 바뀌면 다시 읽음, 읽기 실패면 마지막 정상 경로 표 유지, 표시 없는 틀은 그대로', async () => {
    writeFileSync(join(dir, 'index.html'), TEMPLATE.replace('index-abc.js', 'index-new.js'));
    await new Promise((r) => setTimeout(r, 2100));
    expect((await page('/tech')).html).toContain('index-new.js');
    unlinkSync(join(dir, 'routes.json'));
    await new Promise((r) => setTimeout(r, 2100));
    expect((await page('/nope')).status).toBe(404);
    writeFileSync(join(dir, 'index.html'), '<html><body><div id="root"></div></body></html>');
    await new Promise((r) => setTimeout(r, 2100));
    const plain = await page('/nope');
    expect(plain.status).toBe(404);
    expect(plain.html).toBe('<html><body><div id="root"></div></body></html>');
  });
});
