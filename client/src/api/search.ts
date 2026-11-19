import { request } from './http';
import type { PagedList, PostSummary } from './types';

export type SearchPeriod = '1W' | '1M' | '1Y' | 'ALL';
export type SearchSort = 'RELEVANCE' | 'LATEST';

export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_MAX_PAGE = 50;

export const SEARCH_TOTAL_CAP = 1000;

export type SearchResult = PagedList<PostSummary> & { totalCapped?: boolean };

export interface SearchQuery {
  q: string;
  tagIds: number[];
  sourceIds: number[];
  period: SearchPeriod;
  sort: SearchSort;
  page: number;
}

export function fetchSearch(query: SearchQuery, signal?: AbortSignal) {
  return request<SearchResult>('/search', {
    signal,
    query: {
      q: query.q,
      tagIds: query.tagIds,
      sourceIds: query.sourceIds,
      period: query.period === 'ALL' ? undefined : query.period,
      sort: query.sort === 'RELEVANCE' ? undefined : query.sort,
      page: query.page,
      size: SEARCH_PAGE_SIZE,
    },
  });
}
