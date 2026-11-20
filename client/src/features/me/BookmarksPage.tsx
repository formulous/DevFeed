import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useSearchParams } from 'react-router';
import { MAX_TAG_FILTER } from '@/api/posts';
import type { BookmarkItem } from '@/api/types';
import { Chip } from '@/components/common/Chip';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { ChipPickerModal } from '@/components/filters/ChipPickerModal';
import { useFilterCatalog } from '@/components/filters/useFilterCatalog';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { formatDateTime, formatNumber } from '@/lib/format';
import { bookmarksQuery } from './queries';

export function parseBookmarkTagIds(params: URLSearchParams) {
  const raw = params.get('tagIds') ?? params.get('tagId') ?? '';
  const ids = raw
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return Array.from(new Set(ids)).slice(0, MAX_TAG_FILTER);
}

export function BookmarksPage() {
  const [params, setParams] = useSearchParams();
  const tagIds = useMemo(() => parseBookmarkTagIds(params), [params]);
  const catalog = useFilterCatalog();
  const [picking, setPicking] = useState(false);
  const list = useInfiniteQuery(bookmarksQuery(tagIds));
  const setTags = (ids: number[]) => setParams(ids.length ? { tagIds: ids.join(',') } : {}, { replace: true });
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
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          className="flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg-secondary"
        >
          태그
          {tagIds.length > 0 && <span className="text-brand">{tagIds.length}</span>}
          <FiChevronDown size={12} aria-hidden />
        </button>
      </div>

      {tagIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="적용된 필터">
          {tagIds.map((id) => (
            <Chip key={id} label={catalog.tagName(id)} onRemove={() => setTags(tagIds.filter((v) => v !== id))} />
          ))}
          <button type="button" onClick={() => setTags([])} className="ml-auto text-xs text-fg-secondary hover:text-brand">
            초기화
          </button>
        </div>
      )}

      {list.isPending ? (
        <div>
          {Array.from({ length: 3 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : list.isError && items.length === 0 ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={tagIds.length ? '이 태그로 저장한 글이 없음' : '아직 북마크한 글이 없음'}
          description="글 카드의 ☆를 누르면 여기에 모임"
        />
      ) : (
        <ul className="divide-y divide-line">
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
        <div>
          <PostCardSkeleton />
        </div>
      )}
      <ChipPickerModal
        open={picking}
        title="태그 선택"
        noun="태그"
        items={catalog.tagItems}
        groups={catalog.tagGroups}
        groupLabel="분류"
        initial={tagIds}
        max={MAX_TAG_FILTER}
        onApply={(ids) => {
          setTags(ids);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </section>
  );
}
