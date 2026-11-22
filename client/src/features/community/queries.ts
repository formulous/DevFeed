import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { ApiError } from '@/api/http';
import { fetchCommunityPopular, fetchCommunityPost, fetchCommunityPosts, fetchWriteStatus } from '@/api/community';
import type { CommunityCategory, PopularPeriod } from '@/api/types';
import { POSTS_KEY } from '@/hooks/usePostActions';

export const COMMUNITY_KEY = ['community'] as const;

export const communityListQuery = (category: CommunityCategory | null, authKey: string) =>
  infiniteQueryOptions({
    queryKey: [...POSTS_KEY, 'community', authKey, category],
    queryFn: ({ pageParam, signal }) => fetchCommunityPosts(category, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const communityPopularQuery = (period: PopularPeriod, category: CommunityCategory | null, authKey: string) =>
  queryOptions({
    queryKey: [...POSTS_KEY, 'community-popular', authKey, period, category],
    queryFn: ({ signal }) => fetchCommunityPopular(period, category, signal),
    staleTime: 5 * 60_000,
  });

export const communityPostKey = (id: number, authKey: string) => [...POSTS_KEY, 'community-post', id, authKey] as const;

export const communityPostQuery = (id: number, authKey: string) =>
  queryOptions({
    queryKey: communityPostKey(id, authKey),
    queryFn: ({ signal }) => fetchCommunityPost(id, signal),
    retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500),
  });

export const writeStatusQuery = queryOptions({
  queryKey: [...COMMUNITY_KEY, 'write-status'],
  queryFn: ({ signal }) => fetchWriteStatus(signal),
  staleTime: 0,
});
