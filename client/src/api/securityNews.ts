import { request } from './http';
import type { CursorPage, NewsRegion, PostSummary, SecurityNewsSource } from './types';

export interface SecurityNewsQuery {
  region: NewsRegion | null;
  sourceIds: number[];
}

export const NEWS_PAGE_SIZE = 20;

export function fetchSecurityNews(q: SecurityNewsQuery, cursor?: string, signal?: AbortSignal) {
  return request<CursorPage<PostSummary>>('/security-news', {
    signal,
    query: { cursor, size: NEWS_PAGE_SIZE, region: q.region, sourceIds: q.sourceIds },
  });
}

export function fetchSecurityNewsSources(signal?: AbortSignal) {
  return request<{ items: SecurityNewsSource[] }>('/security-news/sources', { signal });
}
