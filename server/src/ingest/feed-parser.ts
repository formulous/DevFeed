import { XMLParser } from 'fast-xml-parser';
import { htmlToText } from './text';

export type FeedFormat = 'RSS' | 'ATOM';

export interface ParsedFeedItem {
  guid: string | null;
  link: string | null;
  title: string | null;
  summaryHtml: string | null;
  contentHtml: string | null;
  publishedAt: Date | null;
  categories: string[];
  thumbnailUrl: string | null;
}

export interface ParsedFeed {
  format: FeedFormat;
  title: string | null;
  siteUrl: string | null;
  items: ParsedFeedItem[];
}

export class FeedParseError extends Error {}

type Node = Record<string, unknown>;

const ARRAY_TAGS = new Set([
  'item',
  'entry',
  'category',
  'link',
  'media:content',
  'media:thumbnail',
  'enclosure',
  'dc:subject',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') return text((value as Node)['#text']);
  return null;
}

function attr(value: unknown, name: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Node)[`@_${name}`];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function list(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(...values: unknown[]): Date | null {
  for (const value of values) {
    const raw = text(value);
    if (!raw) continue;
    const date = new Date(DATE_ONLY.test(raw) ? `${raw}T00:00:00+09:00` : raw);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function isHttpUrl(value: string | null): value is string {
  return !!value && /^https?:\/\//i.test(value) && value.length <= 2048;
}

function firstImageInHtml(html: string | null): string | null {
  if (!html) return null;
  const match = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i.exec(html);
  return match && isHttpUrl(match[1]) ? match[1] : null;
}

function findThumbnail(item: Node, htmls: (string | null)[]): string | null {
  for (const thumb of list(item['media:thumbnail'])) {
    const url = attr(thumb, 'url');
    if (isHttpUrl(url)) return url;
  }
  for (const content of list(item['media:content'])) {
    const url = attr(content, 'url');
    const medium = attr(content, 'medium');
    const type = attr(content, 'type');
    if (isHttpUrl(url) && (medium === 'image' || type?.startsWith('image/'))) return url;
  }
  for (const enclosure of list(item.enclosure)) {
    const url = attr(enclosure, 'url');
    if (isHttpUrl(url) && attr(enclosure, 'type')?.startsWith('image/')) return url;
  }
  for (const link of list(item.link)) {
    const href = attr(link, 'href');
    if (attr(link, 'rel') === 'enclosure' && attr(link, 'type')?.startsWith('image/') && isHttpUrl(href)) {
      return href;
    }
  }
  for (const html of htmls) {
    const url = firstImageInHtml(html);
    if (url) return url;
  }
  return null;
}

function categories(item: Node): string[] {
  const values = [
    ...list(item.category).map((c) => text(c) ?? attr(c, 'term') ?? attr(c, 'label')),
    ...list(item['dc:subject']).map((c) => text(c)),
  ];
  return [...new Set(values.filter((v): v is string => !!v).map((v) => htmlToText(v)))].filter(
    Boolean,
  );
}

function rawHtml(value: unknown): string | null {
  return text(value);
}

function parseRssItem(item: Node): ParsedFeedItem {
  const summaryHtml = rawHtml(item.description);
  const contentHtml = rawHtml(item['content:encoded']);
  const guidNode = list(item.guid)[0];
  const guid = text(guidNode);
  const link = list(item.link).map((l) => text(l) ?? attr(l, 'href')).find(Boolean) ?? null;
  const permalinkGuid =
    !link && guid && attr(guidNode, 'isPermaLink') !== 'false' && isHttpUrl(guid) ? guid : null;
  return {
    guid,
    link: link ?? permalinkGuid,
    title: rawHtml(item.title),
    summaryHtml,
    contentHtml,
    publishedAt: parseDate(item.pubDate, item['dc:date'], item.published, item.updated),
    categories: categories(item),
    thumbnailUrl: findThumbnail(item, [summaryHtml, contentHtml]),
  };
}

function atomLink(links: unknown[]): string | null {
  const candidates = links.map((l) => ({ rel: attr(l, 'rel') ?? 'alternate', href: attr(l, 'href') ?? text(l) }));
  const alternate = candidates.find((c) => c.rel === 'alternate' && c.href);
  return alternate?.href ?? candidates.find((c) => c.href)?.href ?? null;
}

function parseAtomEntry(entry: Node): ParsedFeedItem {
  const summaryHtml = rawHtml(entry.summary);
  const contentHtml = rawHtml(entry.content);
  return {
    guid: text(entry.id),
    link: atomLink(list(entry.link)),
    title: rawHtml(entry.title),
    summaryHtml,
    contentHtml,
    publishedAt: parseDate(entry.published, entry.updated, entry.issued, entry.modified),
    categories: categories(entry),
    thumbnailUrl: findThumbnail(entry, [summaryHtml, contentHtml]),
  };
}

export function parseFeed(xml: string): ParsedFeed {
  let doc: Node;
  try {
    doc = parser.parse(xml, true) as Node;
  } catch (error) {
    throw new FeedParseError(`XML 파싱 실패: ${(error as Error).message.split('\n')[0]}`);
  }

  const rss = doc.rss as Node | undefined;
  if (rss && typeof rss === 'object') {
    const channel = (list(rss.channel)[0] ?? {}) as Node;
    return {
      format: 'RSS',
      title: htmlToText(text(channel.title)) || null,
      siteUrl: list(channel.link).map((l) => text(l) ?? attr(l, 'href')).find(isHttpUrl) ?? null,
      items: list(channel.item).map((i) => parseRssItem(i as Node)),
    };
  }

  const rdf = doc['rdf:RDF'] as Node | undefined;
  if (rdf && typeof rdf === 'object') {
    const channel = (list(rdf.channel)[0] ?? {}) as Node;
    return {
      format: 'RSS',
      title: htmlToText(text(channel.title)) || null,
      siteUrl: text(channel.link),
      items: list(rdf.item).map((i) => parseRssItem(i as Node)),
    };
  }

  const feed = doc.feed as Node | undefined;
  if (feed && typeof feed === 'object') {
    return {
      format: 'ATOM',
      title: htmlToText(text(feed.title)) || null,
      siteUrl: atomLink(list(feed.link)),
      items: list(feed.entry).map((e) => parseAtomEntry(e as Node)),
    };
  }

  throw new FeedParseError('RSS/Atom 형식이 아님');
}
