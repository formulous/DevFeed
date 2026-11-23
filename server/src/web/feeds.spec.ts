import { rss } from './rss';
import { sitemapIndex, sitemapPage, sitemapPageCount, urlset } from './sitemap';
import { xmlText } from './xml';

describe('xmlText', () => {
  it('XML 특수 문자 이스케이프, 쓸 수 없는 제어 문자 제거', () => {
    expect(xmlText(`a&b<c>"d'\u0001\u000be\n`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;e\n');
  });
});

describe('sitemap', () => {
  it('urlset: lastmod는 ISO, 없으면 생략', () => {
    const xml = urlset([{ loc: 'https://x.test/tech' }, { loc: 'https://x.test/p?a=1&b=2', lastmod: new Date('2026-11-01T00:00:00Z') }]);
    expect(xml).toContain('<url><loc>https://x.test/tech</loc></url>');
    expect(xml).toContain('<loc>https://x.test/p?a=1&amp;b=2</loc><lastmod>2026-11-01T00:00:00.000Z</lastmod>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
  });

  it('분할: 고정 화면 4개 포함해 한 파일 최대 건수, 1번에 고정 화면', () => {
    expect(sitemapPageCount(0, 10)).toBe(1);
    expect(sitemapPageCount(6, 10)).toBe(1);
    expect(sitemapPageCount(7, 10)).toBe(2);
    expect(sitemapPageCount(16, 10)).toBe(2);
    expect(sitemapPageCount(17, 10)).toBe(3);
    expect(sitemapPage(1, 10)).toEqual({ postOffset: 0, postLimit: 6, includeStatic: true });
    expect(sitemapPage(2, 10)).toEqual({ postOffset: 6, postLimit: 10, includeStatic: false });
    expect(sitemapPage(3, 10)).toEqual({ postOffset: 16, postLimit: 10, includeStatic: false });
    expect(sitemapIndex(['https://x.test/sitemap-1.xml'])).toContain('<sitemap><loc>https://x.test/sitemap-1.xml</loc></sitemap>');
  });
});

describe('rss', () => {
  const channel = { title: 'T', link: 'https://x.test/community', self: 'https://x.test/community/rss.xml', description: 'D' };

  it('항목 필드·이스케이프·작성자 없으면 dc:creator 생략', () => {
    const at = new Date('2026-11-01T09:30:00Z');
    const xml = rss(channel, [
      { title: '<b>제목</b> & ', link: 'https://x.test/community/posts/1', description: '요약', publishedAt: at, author: '닉', category: '질문' },
      { title: '둘', link: 'https://x.test/community/posts/2', description: '', publishedAt: at, author: null, category: '공유' },
    ]);
    expect(xml).toContain('<title>&lt;b&gt;제목&lt;/b&gt; &amp; </title>');
    expect(xml).toContain('<guid isPermaLink="true">https://x.test/community/posts/1</guid>');
    expect(xml).toContain('<pubDate>Sun, 01 Nov 2026 09:30:00 GMT</pubDate>');
    expect(xml).toContain('<dc:creator>닉</dc:creator>');
    expect(xml.match(/<dc:creator>/g)).toHaveLength(1);
    expect(xml).toContain('<lastBuildDate>Sun, 01 Nov 2026 09:30:00 GMT</lastBuildDate>');
    expect(xml).toContain('<atom:link href="https://x.test/community/rss.xml" rel="self" type="application/rss+xml"/>');
  });

  it('글이 없어도 올바른 채널', () => {
    const xml = rss(channel, []);
    expect(xml).not.toContain('<item>');
    expect(xml).not.toContain('lastBuildDate');
    expect(xml).toContain('  </channel>\n</rss>\n');
  });
});
