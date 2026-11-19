import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { fetchFeed, fetchSources, fetchTags, type FeedQuery } from '@/api/posts';
import { POSTS_KEY } from '@/hooks/usePostActions';

export const feedQuery = (filters: FeedQuery, authKey: string) =>
  infiniteQueryOptions({
    queryKey: [...POSTS_KEY, 'feed', authKey, filters],
    queryFn: ({ pageParam, signal }) => fetchFeed(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
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
