import { request } from './http';
import type { CommunityCategory, NewsRegion, PagedList, PostSummary } from './types';
import { scopeInfo, type SearchScopeKey } from '@/lib/searchScope';

export type SearchPeriod = '1W' | '1M' | '1Y' | 'ALL';
export type SearchSort = 'RELEVANCE' | 'LATEST';

export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_MAX_PAGE = 50;

export const SEARCH_TOTAL_CAP = 1000;

export type SearchResult = PagedList<PostSummary> & { totalCapped?: boolean };

export interface SearchQuery {
  q: string;
  scope: SearchScopeKey;
  region: NewsRegion | null;
  category: CommunityCategory | null;
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
      scope: query.scope === 'tech' ? undefined : scopeInfo(query.scope).api,
      tagIds: query.scope === 'tech' ? query.tagIds : undefined,
      sourceIds: query.scope === 'tech' ? query.sourceIds : undefined,
      region: query.scope === 'security' ? query.region : undefined,
      category: query.scope === 'community' ? query.category : undefined,
      period: query.period === 'ALL' ? undefined : query.period,
      sort: query.sort === 'RELEVANCE' ? undefined : query.sort,
      page: query.page,
      size: SEARCH_PAGE_SIZE,
    },
  });
}
