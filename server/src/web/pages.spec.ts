import { escapeHtml, scriptJson } from './html';
import { BODY_MARK, HEAD_CLOSE, HEAD_OPEN, hasMarks, inject, renderHead } from './inject';
import { markdownToSafeHtml } from './markdown-html';
import { fillPattern, matchRoute, normalizePath, parseSeoRoutes, SeoRoute } from './seo-routes';
import { isPagePath } from './web-pages.middleware';

const route = (pattern: string, extra: Partial<SeoRoute> = {}): SeoRoute => ({
  pattern,
  title: pattern,
  description: 'd',
  robots: 'index, follow',
  canonical: pattern,
  ...extra,
});

describe('경로 매칭', () => {
  const routes = [route('/'), route('/admin/sources/new'), route('/admin/sources/:id'), route('/community/posts/:id', { dynamic: true })];

  it('정확히 일치·앞 항목 우선·:param 한 칸·끝 / 무시', () => {
    expect(matchRoute(routes, '/')?.route.pattern).toBe('/');
    expect(matchRoute(routes, '/admin/sources/new')?.route.pattern).toBe('/admin/sources/new');
    expect(matchRoute(routes, '/admin/sources/7')).toEqual({ route: routes[2], params: { id: '7' } });
    expect(matchRoute(routes, '/community/posts/3/')?.params).toEqual({ id: '3' });
    expect(matchRoute(routes, '/community/posts/3/edit')).toBeNull();
    expect(matchRoute(routes, '/community/posts')).toBeNull();
    expect(normalizePath('')).toBe('/');
  });

  it('canonical 채우기는 값 인코딩', () => {
    expect(fillPattern('/community/posts/:id', { id: '1"<' })).toBe('/community/posts/1%22%3C');
  });

  it('routes.json 형식 검사', () => {
    const ok = { origin: 'o', siteName: 's', defaultTitle: 't', defaultDescription: 'd', routes: [route('/')], notFound: route('*') };
    expect(parseSeoRoutes(JSON.stringify(ok)).routes).toHaveLength(1);
    expect(() => parseSeoRoutes(JSON.stringify({ ...ok, routes: [{ pattern: '/' }] }))).toThrow();
    expect(() => parseSeoRoutes(JSON.stringify({ ...ok, notFound: undefined }))).toThrow();
    expect(() => parseSeoRoutes('{')).toThrow();
  });
});

describe('주입', () => {
  const template = `<head>${HEAD_OPEN}<title>기본</title>${HEAD_CLOSE}<link></head><div id="root">${BODY_MARK}</div>`;

  it('머리말 구간 전체 교체·본문 표시 교체', () => {
    const html = inject(template, '<title>새</title>', '<p>본문</p>');
    expect(html).toContain(`${HEAD_OPEN}\n<title>새</title>\n    ${HEAD_CLOSE}<link>`);
    expect(html).not.toContain('기본');
    expect(html).toContain('<div id="root"><p>본문</p></div>');
  });

  it('표시가 없거나 두 번 이상이면 틀 그대로', () => {
    expect(hasMarks(template)).toBe(true);
    for (const t of [template.replace(BODY_MARK, ''), template.replace(HEAD_CLOSE, ''), template + BODY_MARK, `${HEAD_CLOSE}${template}`]) {
      expect(inject(t, 'x', 'y')).toBe(t);
    }
  });

  it('본문에 $ 패턴이 있어도 그대로 들어감', () => {
    expect(inject(template, "$&$'", "$`$1")).toContain("<div id=\"root\">$`$1</div>");
  });

  it('머리말 값 이스케이프, canonical 없으면 canonical·og:url 생략, JSON은 script 탈출 불가', () => {
    const head = renderHead({
      title: '"><script>alert(1)</script>',
      description: "a'b&",
      robots: 'noindex, follow',
      canonicalUrl: null,
      ogType: 'website',
      seoData: { t: '</script><script>alert(1)</script>\u2028' },
    });
    expect(head).toContain('<title data-seo="title">&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>');
    expect(head).toContain('content="a&#39;b&amp;"');
    expect(head).not.toContain('canonical');
    expect(head).not.toContain('og:url');
    expect(head).not.toContain('</script><script>');
    expect(head).toContain('\\u003c/script\\u003e');
    expect(head).toContain('\\u2028');
  });
});

describe('scriptJson·escapeHtml', () => {
  it('되돌리면 같은 값', () => {
    const value = { a: '<>&\u2028\u2029"' };
    expect(JSON.parse(scriptJson(value))).toEqual(value);
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});

describe('마크다운 무해화 (032 기준)', () => {
  it('기본 서식·GFM 표·코드', () => {
    const html = markdownToSafeHtml('# 제목\n\n**굵게** ~~취소~~\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst a = 1 < 2;\n```');
    expect(html).toContain('<h2>제목</h2>');
    expect(html).toContain('<strong>굵게</strong> <del>취소</del>');
    expect(html).toContain('<table>');
    expect(html).toContain('<pre><code class="language-ts">const a = 1 &lt; 2;\n</code></pre>');
  });

  it('원문 HTML은 글자, 스크립트·이벤트 속성 없음', () => {
    const html = markdownToSafeHtml('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n안녕 <b onclick="x()">굵게</b>');
    expect(html).not.toMatch(/<script|<img|<b[\s>]|<[^>]*\son(error|click)=/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('링크는 http(s)만, nofollow, 그 외는 span', () => {
    const html = markdownToSafeHtml('[a](https://ok.test) [b](javascript:alert(1)) [c](data:text/html,x) [d](//evil.test) [e](mailto:a@b.c)');
    expect(html).toContain('<a href="https://ok.test" target="_blank" rel="nofollow ugc noopener noreferrer">a</a>');
    expect(html).not.toMatch(/javascript:|data:|evil\.test|mailto:/);
    expect(html.match(/<span>/g)).toHaveLength(4);
  });

  it('이미지는 [이미지: alt] 글자, 작은 제목은 h4', () => {
    const html = markdownToSafeHtml('![고양이 "<"](https://x.test/a.png)\n\n###### 작은');
    expect(html).toContain('<p>[이미지: 고양이 "&lt;"]</p>');
    expect(html).not.toContain('<img');
    expect(html).toContain('<h4>작은</h4>');
  });
});

describe('HTML 경로 판정', () => {
  it('api·sitemap·rss·파일은 제외', () => {
    for (const p of ['/', '/tech', '/community/posts/1', '/nope', '/community/rss']) expect(isPagePath(p)).toBe(true);
    for (const p of ['/api/health', '/sitemap.xml', '/sitemap-2.xml', '/community/rss.xml', '/assets/a.js', '/favicon.svg', '/routes.json']) {
      expect(isPagePath(p)).toBe(false);
    }
  });
});
