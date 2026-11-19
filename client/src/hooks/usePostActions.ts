import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { deleteBookmark, putBookmark, recordView } from '@/api/posts';
import type { CursorPage, PostSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { useLoginPrompt } from '@/auth/LoginPromptProvider';

export const POSTS_KEY = ['posts'] as const;

type ListCache = { items: PostSummary[] };
type PostsCache = InfiniteData<CursorPage<PostSummary>> | ListCache | undefined;

function patchItems<T extends ListCache>(list: T, postId: number, patch: Partial<PostSummary>): T {
  return { ...list, items: list.items.map((item) => (item.id === postId ? { ...item, ...patch } : item)) };
}

function patchPost(client: QueryClient, postId: number, patch: Partial<PostSummary>) {
  client.setQueriesData<PostsCache>({ queryKey: POSTS_KEY }, (data) => {
    if (!data) return data;
    if ('pages' in data) return { ...data, pages: data.pages.map((page) => patchItems(page, postId, patch)) };
    return patchItems(data, postId, patch);
  });
}

export function useToggleBookmark() {
  const client = useQueryClient();
  const { status } = useAuth();
  const { openLoginPrompt } = useLoginPrompt();

  const mutation = useMutation({
    mutationFn: ({ postId, next }: { postId: number; next: boolean }) =>
      next ? putBookmark(postId) : deleteBookmark(postId),
    onMutate: async ({ postId, next }) => {
      await client.cancelQueries({ queryKey: POSTS_KEY });
      patchPost(client, postId, { isBookmarked: next });
    },
    onError: (_error, { postId, next }) => {
      patchPost(client, postId, { isBookmarked: !next });
    },
  });

  return (post: PostSummary) => {
    if (status !== 'member') {
      openLoginPrompt('북마크하려면 로그인이 필요함');
      return;
    }
    mutation.mutate({ postId: post.id, next: !post.isBookmarked });
  };
}

export function useOpenPost() {
  const client = useQueryClient();
  const { status } = useAuth();
  return (post: PostSummary, recommendationId?: string) => {
    recordView(post.id, recommendationId);
    if (status === 'member' && !post.isRead) patchPost(client, post.id, { isRead: true });
  };
}
