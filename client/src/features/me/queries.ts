import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { fetchBookmarks, fetchHistory, fetchInterestTags } from '@/api/me';
import { POSTS_KEY } from '@/hooks/usePostActions';

export const interestTagsQuery = queryOptions({
  queryKey: ['me', 'interest-tags'],
  queryFn: fetchInterestTags,
  select: (data) => data.items,
});

export const bookmarksQuery = (tagId: number | null) =>
  infiniteQueryOptions({
    queryKey: [...POSTS_KEY, 'bookmarks', tagId],
    queryFn: ({ pageParam, signal }) => fetchBookmarks(tagId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const historyQuery = infiniteQueryOptions({
  queryKey: [...POSTS_KEY, 'history'],
  queryFn: ({ pageParam, signal }) => fetchHistory(pageParam, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});
