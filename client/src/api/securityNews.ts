import { request } from './http';
import type { CursorPage, NewsRegion, PopularPeriod, PopularPost, PostSummary, SecurityNewsSource } from './types';

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

export function fetchSecurityPopular(period: PopularPeriod, region: NewsRegion | null, signal?: AbortSignal) {
  return request<{ items: PopularPost[] }>('/security-news/popular', { signal, query: { period, region } });
}

export function fetchSecurityNewsSources(signal?: AbortSignal) {
  return request<{ items: SecurityNewsSource[] }>('/security-news/sources', { signal });
}
