import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { fetchSecurityNews, fetchSecurityNewsSources, fetchSecurityPopular, type SecurityNewsQuery } from '@/api/securityNews';
import type { NewsRegion, PopularPeriod } from '@/api/types';
import { POSTS_KEY } from '@/hooks/usePostActions';

export const securityNewsQuery = (q: SecurityNewsQuery, authKey: string) =>
  infiniteQueryOptions({
    queryKey: [...POSTS_KEY, 'security-news', authKey, q],
    queryFn: ({ pageParam, signal }) => fetchSecurityNews(q, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const securityPopularQuery = (period: PopularPeriod, region: NewsRegion | null, authKey: string) =>
  queryOptions({
    queryKey: [...POSTS_KEY, 'security-popular', authKey, period, region],
    queryFn: ({ signal }) => fetchSecurityPopular(period, region, signal),
    staleTime: 5 * 60_000,
  });

export const securitySourcesQuery = queryOptions({
  queryKey: ['security-news', 'sources'],
  queryFn: ({ signal }) => fetchSecurityNewsSources(signal),
  staleTime: 10 * 60_000,
  select: (data) => data.items,
});
