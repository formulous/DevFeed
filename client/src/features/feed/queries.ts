import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { fetchFeed, fetchPopular, fetchSources, fetchTags, type FeedQuery } from '@/api/posts';
import type { PopularPeriod, TechRankSort } from '@/api/types';
import type { ApiField } from '@/lib/fields';
import { POSTS_KEY } from '@/hooks/usePostActions';

export const feedQuery = (filters: FeedQuery, authKey: string) =>
  infiniteQueryOptions({
    queryKey: [...POSTS_KEY, 'feed', authKey, filters],
    queryFn: ({ pageParam, signal }) => fetchFeed(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const popularQuery = (period: PopularPeriod, field: ApiField | null, authKey: string, sort: TechRankSort = 'VIEWS') =>
  queryOptions({
    queryKey: [...POSTS_KEY, 'popular', authKey, period, field, sort],
    queryFn: ({ signal }) => fetchPopular(period, field, sort, signal),
    staleTime: 5 * 60_000,
  });

export const tagsQuery = queryOptions({
  queryKey: ['tags'],
  queryFn: ({ signal }) => fetchTags(signal),
  staleTime: 10 * 60_000,
  select: (data) => data.items,
});

export const sourcesQuery = queryOptions({
  queryKey: ['sources'],
  queryFn: ({ signal }) => fetchSources(signal),
  staleTime: 10 * 60_000,
  select: (data) => data.items,
});
