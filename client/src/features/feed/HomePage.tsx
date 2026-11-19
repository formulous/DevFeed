import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiFilter } from 'react-icons/fi';
import { Button } from '@onyx/components/button/button';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { useFeedFilters } from '@/hooks/useFeedFilters';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { cn } from '@/lib/cn';
import { ActiveFilterChips } from './ActiveFilterChips';
import { FeedSidebar } from './FeedSidebar';
import { feedQuery } from './queries';

export function HomePage() {
  const { status } = useAuth();
  const { filters, reset } = useFeedFilters();
  const [filterOpen, setFilterOpen] = useState(false);
  const feed = useInfiniteQuery({ ...feedQuery(filters, status), enabled: status !== 'loading' });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();

  const sentinelRef = useInfiniteScroll(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
  }, feed.hasNextPage && !feed.isError);

  const posts = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-64 lg:shrink-0">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-fg-secondary lg:hidden"
        >
          <FiFilter size={14} /> 필터
        </button>
        <div className={cn(filterOpen ? 'block' : 'hidden', 'lg:sticky lg:top-28 lg:block')}>
          <FeedSidebar />
        </div>
      </aside>

      <section className="min-w-0 flex-1" aria-label="최신 피드">
        <h1 className="sr-only">최신 피드</h1>
        <ActiveFilterChips />

        {feed.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : feed.isError && posts.length === 0 ? (
          <ErrorState message={feed.error.message} onRetry={() => feed.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState
            title="조건에 맞는 글이 없음"
            action={<Button variant="outlined" width={96} height={36} content="필터 초기화" onClick={reset} />}
          />
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} onOpen={openPost} onToggleBookmark={toggleBookmark} />
              </li>
            ))}
          </ul>
        )}

        <div ref={sentinelRef} />
        {feed.isFetchingNextPage && (
          <div className="mt-3">
            <PostCardSkeleton />
          </div>
        )}
        {feed.isError && posts.length > 0 && (
          <div className="mt-3 text-center">
            <button type="button" onClick={() => feed.fetchNextPage()} className="text-sm text-brand">
              더 불러오지 못했음. 다시 시도
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
