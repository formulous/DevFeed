import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import type { BookmarkItem } from '@/api/types';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { tagsQuery } from '@/features/feed/queries';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { formatDateTime, formatNumber } from '@/lib/format';
import { bookmarksQuery } from './queries';

export function BookmarksPage() {
  const [params, setParams] = useSearchParams();
  const tagParam = Number(params.get('tagId'));
  const tagId = Number.isInteger(tagParam) && tagParam > 0 ? tagParam : null;
  const tags = useQuery(tagsQuery);
  const list = useInfiniteQuery(bookmarksQuery(tagId));
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();
  const sentinel = useInfiniteScroll(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  }, list.hasNextPage && !list.isError);

  const items = (list.data?.pages.flatMap((p) => p.items) ?? []) as BookmarkItem[];
  const total = list.data?.pages[0]?.total;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">
          북마크 {total !== undefined && <span className="text-fg-secondary">({formatNumber(total)})</span>}
        </h1>
        <select
          aria-label="태그"
          value={tagId ?? ''}
          onChange={(e) => setParams(e.target.value ? { tagId: e.target.value } : {}, { replace: true })}
          className="h-8 max-w-[180px] rounded-lg border border-line bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200/40"
        >
          <option value="">태그 전체</option>
          {(tags.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {list.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : list.isError && items.length === 0 ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={tagId ? '이 태그로 저장한 글이 없음' : '아직 북마크한 글이 없음'}
          description="글 카드의 ☆를 누르면 여기에 모임"
        />
      ) : (
        <ul className="space-y-3">
          {items.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                onOpen={openPost}
                onToggleBookmark={toggleBookmark}
                meta={`저장 ${formatDateTime(post.bookmarkedAt)}`}
              />
            </li>
          ))}
        </ul>
      )}
      <div ref={sentinel} />
      {list.isFetchingNextPage && (
        <div className="mt-3">
          <PostCardSkeleton />
        </div>
      )}
    </section>
  );
}
