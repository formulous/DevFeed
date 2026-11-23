import { request } from './http';
import type { ApiField } from '@/lib/fields';
import type { CommunityCategory, NewsRegion, PopularPost } from './types';

export type TopScope = 'tech' | 'security' | 'community';

export const WEEKLY_TOP_SIZE = 3;

export interface WeeklyTopFilter {
  field?: ApiField | null;
  region?: NewsRegion | null;
  category?: CommunityCategory | null;
}

const PATH: Record<TopScope, string> = {
  tech: '/posts/popular',
  security: '/security-news/popular',
  community: '/community/popular',
};

export function fetchWeeklyTop(scope: TopScope, filter: WeeklyTopFilter, signal?: AbortSignal) {
  const extra =
    scope === 'tech' ? { field: filter.field } : scope === 'security' ? { region: filter.region } : { category: filter.category };
  return request<{ items: PopularPost[] }>(PATH[scope], {
    signal,
    query: { period: 'WEEK', sort: 'REACTIONS', size: WEEKLY_TOP_SIZE, ...extra },
  });
}
