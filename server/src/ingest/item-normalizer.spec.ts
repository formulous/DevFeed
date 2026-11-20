import type { ParsedFeedItem } from './feed-parser';
import { normalizeItem } from './item-normalizer';

const now = new Date('2026-11-19T00:00:00Z');
const base: ParsedFeedItem = {
  guid: 'g1',
  link: '/post?utm_medium=feed',
  title: '<b>제목</b>',
  summaryHtml: null,
  contentHtml: '<p>본문 요약</p>',
  publishedAt: new Date('2026-11-18T00:00:00Z'),
  categories: [],
  thumbnailUrl: null,
};

describe('normalizeItem', () => {
  it('URL 정규화·제목 정리·요약 대체를 적용함', () => {
    const item = normalizeItem(base, { baseUrl: 'https://a.com', now });
    expect(item).toMatchObject({
      guid: 'g1',
      url: 'https://a.com/post',
      title: '제목',
      summary: '본문 요약',
      publishedAt: base.publishedAt,
      originalPublishedAt: base.publishedAt,
    });
  });

  it('발행일이 없거나 미래면 수집 시각으로 대체하고 원래 값은 보관함', () => {
    const future = new Date('2027-01-01T00:00:00Z');
    expect(normalizeItem({ ...base, publishedAt: future }, { baseUrl: 'https://a.com', now })).toMatchObject({
      publishedAt: now,
      originalPublishedAt: future,
    });
    expect(normalizeItem({ ...base, publishedAt: null }, { baseUrl: 'https://a.com', now })).toMatchObject({
      publishedAt: now,
      originalPublishedAt: null,
    });
  });

  it('링크나 제목이 없으면 건너뜀', () => {
    expect(normalizeItem({ ...base, link: null }, { baseUrl: 'https://a.com', now })).toBeNull();
    expect(normalizeItem({ ...base, title: '  ' }, { baseUrl: 'https://a.com', now })).toBeNull();
  });

  it('보안 뉴스는 요약 150자로 자르고 썸네일을 버림', () => {
    const long = '가'.repeat(400);
    const item = normalizeItem(
      { ...base, contentHtml: `<p>${long}</p>`, thumbnailUrl: 'https://img.a.com/x.png' },
      { baseUrl: 'https://a.com', now, kind: 'SECURITY_NEWS' },
    );
    expect(Array.from(item!.summary!).length).toBeLessThanOrEqual(150);
    expect(item!.thumbnailUrl).toBeNull();
    const blog = normalizeItem({ ...base, contentHtml: `<p>${long}</p>`, thumbnailUrl: 'https://img.a.com/x.png' }, { baseUrl: 'https://a.com', now });
    expect(Array.from(blog!.summary!).length).toBe(300);
    expect(blog!.thumbnailUrl).toBe('https://img.a.com/x.png');
  });

  it('너무 긴 guid는 버리고 URL로만 중복 판단함', () => {
    expect(normalizeItem({ ...base, guid: 'x'.repeat(1100) }, { baseUrl: 'https://a.com', now })?.guid).toBeNull();
  });
});
