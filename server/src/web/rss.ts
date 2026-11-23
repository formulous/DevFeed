import { xmlText } from './xml';

export const RSS_ITEMS = 50;

export interface RssItem {
  title: string;
  link: string;
  description: string;
  publishedAt: Date;
  author: string | null;
  category: string;
}

export interface RssChannel {
  title: string;
  link: string;
  self: string;
  description: string;
}

export function rss(channel: RssChannel, items: RssItem[]): string {
  const body = items.map((item) =>
    [
      '    <item>',
      `      <title>${xmlText(item.title)}</title>`,
      `      <link>${xmlText(item.link)}</link>`,
      `      <guid isPermaLink="true">${xmlText(item.link)}</guid>`,
      `      <description>${xmlText(item.description)}</description>`,
      `      <pubDate>${item.publishedAt.toUTCString()}</pubDate>`,
      ...(item.author ? [`      <dc:creator>${xmlText(item.author)}</dc:creator>`] : []),
      `      <category>${xmlText(item.category)}</category>`,
      '    </item>',
    ].join('\n'),
  );
  const lastBuild = items[0] ? `\n    <lastBuildDate>${items[0].publishedAt.toUTCString()}</lastBuildDate>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xmlText(channel.title)}</title>
    <link>${xmlText(channel.link)}</link>
    <atom:link href="${xmlText(channel.self)}" rel="self" type="application/rss+xml"/>
    <description>${xmlText(channel.description)}</description>
    <language>ko</language>${lastBuild}
${body.join('\n')}${body.length ? '\n' : ''}  </channel>
</rss>
`;
}
