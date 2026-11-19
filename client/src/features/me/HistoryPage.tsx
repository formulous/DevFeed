import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { Button } from '@onyx/components/button/button';
import { clearHistory, deleteHistoryItem } from '@/api/me';
import type { CursorPage, HistoryItem } from '@/api/types';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/components/common/Toast';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { errorMessage } from '@/lib/errors';
import { historyQuery } from './queries';

type HistoryCache = InfiniteData<CursorPage<HistoryItem>>;

export function localDateKey(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function groupByDate(items: HistoryItem[]) {
  const groups: { date: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const date = localDateKey(item.readAt);
    const last = groups[groups.length - 1];
    if (last?.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}

export function HistoryPage() {
  const client = useQueryClient();
  const toast = useToast();
  const list = useInfiniteQuery(historyQuery);
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();
  const [confirmClear, setConfirmClear] = useState(false);
  const sentinel = useInfiniteScroll(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  }, list.hasNextPage && !list.isError);

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const groups = useMemo(() => groupByDate(items), [items]);

  const removeOne = useMutation({
    mutationFn: (postId: number) => deleteHistoryItem(postId),
    onSuccess: (_d, postId) => {
      client.setQueryData<HistoryCache>(historyQuery.queryKey, (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== postId) })),
        },
      );
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const removeAll = useMutation({
    mutationFn: clearHistory,
    onSuccess: () => {
      setConfirmClear(false);
      client.setQueryData<HistoryCache>(historyQuery.queryKey, (data) =>
        data && { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] },
      );
      client.invalidateQueries({ queryKey: ['posts'], refetchType: 'inactive' });
      toast('읽은 기록을 모두 지웠음');
    },
    onError: (e) => {
      setConfirmClear(false);
      toast(errorMessage(e), 'error');
    },
  });

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">읽은 기록</h1>
        <Button
          variant="outlined"
          width={80}
          height={32}
          content="전체 삭제"
          disabled={items.length === 0}
          onClick={() => setConfirmClear(true)}
        />
      </div>
      <p className="mb-4 text-xs text-fg-muted">원문을 연 글이 최근 읽은 순으로 쌓임. 1년 지나면 자동 삭제됨</p>

      {list.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : list.isError && items.length === 0 ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="읽은 기록이 없음" description="글 카드를 눌러 원문을 열면 여기에 남음" />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.date} aria-label={g.date}>
              <h2 className="mb-2 text-sm font-semibold text-fg-secondary">{g.date}</h2>
              <ul className="space-y-2">
                {g.items.map((post) => (
                  <li key={post.id} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <PostCard post={{ ...post, isRead: false }} onOpen={openPost} onToggleBookmark={toggleBookmark} />
                    </div>
                    <button
                      type="button"
                      aria-label={`${post.title} 기록 삭제`}
                      disabled={removeOne.isPending && removeOne.variables === post.id}
                      onClick={() => removeOne.mutate(post.id)}
                      className="mt-3 rounded p-1 text-fg-muted hover:bg-slate-100 hover:text-fg"
                    >
                      <FiX size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <div ref={sentinel} />

      <ConfirmModal
        open={confirmClear}
        title="읽은 기록 전체 삭제"
        confirmLabel="전체 삭제"
        danger
        pending={removeAll.isPending}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => removeAll.mutate()}
      >
        읽은 기록을 모두 지움. 되돌릴 수 없음. 피드의 읽음 표시도 함께 사라짐.
      </ConfirmModal>
    </section>
  );
}
