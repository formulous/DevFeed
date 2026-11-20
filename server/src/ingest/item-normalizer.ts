import type { ParsedFeedItem } from './feed-parser';
import { makeSummaryWithin, makeTitle, NEWS_SUMMARY_MAX_LENGTH, SUMMARY_MAX_LENGTH } from './text';
import { normalizePostUrl } from './url-normalizer';

export const GUID_MAX_LENGTH = 1024;

export type ContentKind = 'BLOG' | 'SECURITY_NEWS';

export interface NormalizedItem {
  guid: string | null;
  url: string;
  title: string;
  summary: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
  originalPublishedAt: Date | null;
  categories: string[];
}

export function normalizeItem(
  item: ParsedFeedItem,
  context: { baseUrl: string; now: Date; kind?: ContentKind },
): NormalizedItem | null {
  const url = item.link ? normalizePostUrl(item.link, context.baseUrl) : null;
  if (!url) return null;
  const title = makeTitle(item.title);
  if (!title) return null;

  const isNews = context.kind === 'SECURITY_NEWS';
  const guid = item.guid && item.guid.length <= GUID_MAX_LENGTH ? item.guid : null;
  const original = item.publishedAt;
  const publishedAt =
    original && original.getTime() <= context.now.getTime() ? original : context.now;

  return {
    guid,
    url,
    title,
    summary: makeSummaryWithin(isNews ? NEWS_SUMMARY_MAX_LENGTH : SUMMARY_MAX_LENGTH, item.summaryHtml, item.contentHtml),
    thumbnailUrl: isNews ? null : item.thumbnailUrl,
    publishedAt,
    originalPublishedAt: original,
    categories: item.categories,
  };
}
