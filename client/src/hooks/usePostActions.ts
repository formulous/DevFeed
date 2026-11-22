import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { deleteBookmark, putBookmark, recordView } from '@/api/posts';
import { deleteLike, putLike } from '@/api/reactions';
import type { CursorPage, PostSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { useLoginPrompt } from '@/auth/LoginPromptProvider';
import { ApiError } from '@/api/http';
import { useToast } from '@/components/common/Toast';
import { refreshProfile } from './useProfile';

export const POSTS_KEY = ['posts'] as const;

type ListCache = { items: PostSummary[] };
type PostsCache = InfiniteData<CursorPage<PostSummary>> | ListCache | undefined;

function patchItems<T extends ListCache>(list: T, postId: number, patch: Partial<PostSummary>): T {
  return { ...list, items: list.items.map((item) => (item.id === postId ? { ...item, ...patch } : item)) };
}

export function patchPost(client: QueryClient, postId: number, patch: Partial<PostSummary>) {
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
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: ({ postId, next }: { postId: number; next: boolean }) =>
      next ? putBookmark(postId) : deleteBookmark(postId),
    onMutate: async ({ postId, next }) => {
      await client.cancelQueries({ queryKey: POSTS_KEY });
      patchPost(client, postId, { isBookmarked: next });
    },
    onError: (error, { postId, next }) => {
      patchPost(client, postId, { isBookmarked: !next });
      toast(
        error instanceof ApiError && error.code === 'BOOKMARK_LIMIT_EXCEEDED'
          ? '북마크는 최대 5,000개까지 저장할 수 있어요'
          : '북마크를 저장하지 못했어요',
        'error',
      );
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: [...POSTS_KEY, 'bookmarks'], refetchType: 'inactive' });
      refreshProfile(client);
    },
  });

  return (post: PostSummary) => {
    if (status !== 'member') {
      openLoginPrompt('북마크하려면 로그인이 필요해요');
      return;
    }
    mutation.mutate({ postId: post.id, next: !post.isBookmarked });
  };
}

export function useOpenPost() {
  const client = useQueryClient();
  const { status } = useAuth();
  return (post: PostSummary, recommendationId?: string) => {
    const sent = recordView(post.id, recommendationId);
    if (status !== 'member') return;
    sent.then(() => refreshProfile(client));
    if (!post.isRead) patchPost(client, post.id, { isRead: true });
    client.invalidateQueries({ queryKey: [...POSTS_KEY, 'history'], refetchType: 'inactive' });
  };
}

const likeSync = new Map<number, { want: boolean }>();

export function useToggleLike() {
  const client = useQueryClient();
  const { status } = useAuth();
  const { openLoginPrompt } = useLoginPrompt();
  const toast = useToast();

  const sync = async (postId: number, want: boolean, before: { likedByMe: boolean; likeCount: number }) => {
    const running = likeSync.get(postId);
    if (running) {
      running.want = want;
      return;
    }
    const entry = { want };
    likeSync.set(postId, entry);
    try {
      let sent: boolean;
      let result;
      do {
        sent = entry.want;
        result = await (sent ? putLike(postId) : deleteLike(postId));
      } while (entry.want !== sent);
      patchPost(client, postId, { likedByMe: result.liked, likeCount: result.likeCount });
    } catch {
      patchPost(client, postId, before);
      toast('좋아요를 반영하지 못했어요', 'error');
    } finally {
      likeSync.delete(postId);
      refreshProfile(client);
    }
  };

  return (post: PostSummary) => {
    if (status !== 'member') {
      openLoginPrompt('좋아요를 누르려면 로그인이 필요해요');
      return;
    }
    const liked = !!post.likedByMe;
    const count = post.likeCount ?? 0;
    const next = !liked;
    patchPost(client, post.id, { likedByMe: next, likeCount: Math.max(0, count + (next ? 1 : -1)) });
    const running = likeSync.get(post.id);
    if (running) running.want = next;
    else sync(post.id, next, { likedByMe: liked, likeCount: count });
  };
}
