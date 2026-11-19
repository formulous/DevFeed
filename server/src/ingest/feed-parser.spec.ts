import { FeedParseError, parseFeed } from './feed-parser';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>테크 블로그</title>
    <link>https://tech.example.com</link>
    <item>
      <title><![CDATA[카프카 <b>리밸런싱</b> 줄이기]]></title>
      <link>https://tech.example.com/kafka?utm_source=rss</link>
      <guid isPermaLink="false">post-1</guid>
      <pubDate>Wed, 18 Nov 2026 10:00:00 +0900</pubDate>
      <category>Kafka</category>
      <category><![CDATA[Backend]]></category>
      <description>&lt;p&gt;요약 &amp;amp; 설명&lt;/p&gt;</description>
      <content:encoded><![CDATA[<p>본문 <img src="https://img.example.com/a.png"></p>]]></content:encoded>
    </item>
    <item>
      <title>두 번째</title>
      <guid>https://tech.example.com/second</guid>
      <dc:date>2026-11-17T01:00:00Z</dc:date>
      <media:thumbnail url="https://img.example.com/thumb.jpg" />
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Atom Blog</title>
  <link rel="self" href="https://atom.example.com/feed.xml"/>
  <link rel="alternate" href="https://atom.example.com/"/>
  <entry>
    <title type="html">Atom &amp;lt;글&amp;gt;</title>
    <id>tag:atom.example.com,2026:1</id>
    <link rel="alternate" type="text/html" href="https://atom.example.com/posts/1"/>
    <link rel="enclosure" type="image/png" href="https://atom.example.com/cover.png"/>
    <updated>2026-11-18T00:00:00Z</updated>
    <published>2026-11-17T00:00:00Z</published>
    <category term="react"/>
    <summary type="html">&lt;p&gt;Atom 요약&lt;/p&gt;</summary>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('RSS 2.0 항목을 파싱함', () => {
    const feed = parseFeed(RSS);
    expect(feed.format).toBe('RSS');
    expect(feed.title).toBe('테크 블로그');
    expect(feed.siteUrl).toBe('https://tech.example.com');
    expect(feed.items).toHaveLength(2);

    const [first, second] = feed.items;
    expect(first.guid).toBe('post-1');
    expect(first.link).toBe('https://tech.example.com/kafka?utm_source=rss');
    expect(first.title).toContain('리밸런싱');
    expect(first.publishedAt?.toISOString()).toBe('2026-11-18T01:00:00.000Z');
    expect(first.categories).toEqual(['Kafka', 'Backend']);
    expect(first.summaryHtml).toContain('<p>');
    expect(first.thumbnailUrl).toBe('https://img.example.com/a.png');

    expect(second.link).toBe('https://tech.example.com/second');
    expect(second.publishedAt?.toISOString()).toBe('2026-11-17T01:00:00.000Z');
    expect(second.thumbnailUrl).toBe('https://img.example.com/thumb.jpg');
  });

  it('Atom 항목을 파싱함', () => {
    const feed = parseFeed(ATOM);
    expect(feed.format).toBe('ATOM');
    expect(feed.title).toBe('Atom Blog');
    expect(feed.siteUrl).toBe('https://atom.example.com/');
    const [entry] = feed.items;
    expect(entry.guid).toBe('tag:atom.example.com,2026:1');
    expect(entry.link).toBe('https://atom.example.com/posts/1');
    expect(entry.publishedAt?.toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(entry.categories).toEqual(['react']);
    expect(entry.thumbnailUrl).toBe('https://atom.example.com/cover.png');
  });

  it('항목이 없어도 유효한 피드로 봄', () => {
    expect(parseFeed('<rss><channel><title>empty</title></channel></rss>').items).toEqual([]);
  });

  it('RSS/Atom이 아니면 FeedParseError', () => {
    expect(() => parseFeed('<html><body>hi</body></html>')).toThrow(FeedParseError);
    expect(() => parseFeed('not xml at all')).toThrow(FeedParseError);
  });
});
