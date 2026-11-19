import { normalizeFeedUrl, normalizePostUrl } from './url-normalizer';

describe('normalizePostUrl', () => {
  it('추적 파라미터와 fragment를 제거하고 나머지 쿼리는 정렬함', () => {
    expect(
      normalizePostUrl('https://Blog.Example.com/posts/1/?utm_source=rss&b=2&a=1&fbclid=x#section'),
    ).toBe('https://blog.example.com/posts/1?a=1&b=2');
  });

  it('끝 슬래시 유무를 같은 URL로 맞춤', () => {
    expect(normalizePostUrl('https://a.com/p/')).toBe(normalizePostUrl('https://a.com/p'));
    expect(normalizePostUrl('https://a.com/')).toBe('https://a.com');
  });

  it('상대 경로는 기준 URL로 해석함', () => {
    expect(normalizePostUrl('/2026/11/post', 'https://tech.example.com/feed.xml')).toBe(
      'https://tech.example.com/2026/11/post',
    );
  });

  it('http(s)가 아니거나 너무 길면 null', () => {
    expect(normalizePostUrl('javascript:alert(1)')).toBeNull();
    expect(normalizePostUrl('not a url')).toBeNull();
    expect(normalizePostUrl(`https://a.com/${'x'.repeat(2100)}`)).toBeNull();
  });
});

describe('normalizeFeedUrl', () => {
  it('fragment만 제거하고 경로는 유지함', () => {
    expect(normalizeFeedUrl(' https://a.com/feed/#x ')).toBe('https://a.com/feed/');
    expect(normalizeFeedUrl('ftp://a.com/feed')).toBeNull();
  });
});
