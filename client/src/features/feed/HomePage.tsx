import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@onyx/components/button/button';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { FilterLayout } from '@/components/filters/FilterLayout';
import { useFeedFilterBindings, useFeedFilters } from '@/hooks/useFeedFilters';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import type { SourceType } from '@/api/types';
import { feedQuery } from './queries';

const LABELS: Record<SourceType | 'ALL', string> = { ALL: '최신 피드', COMPANY: '기업 블로그 피드', PERSONAL: '개인 블로그 피드' };

export function HomePage({ sourceType = null }: { sourceType?: SourceType | null }) {
  const { status } = useAuth();
  const { filters, reset } = useFeedFilters(sourceType);
  const bindings = useFeedFilterBindings(sourceType);
  const label = LABELS[sourceType ?? 'ALL'];
  const feed = useInfiniteQuery({ ...feedQuery(filters, status), enabled: status !== 'loading' });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();

  const sentinelRef = useInfiniteScroll(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
  }, feed.hasNextPage && !feed.isError);

  const posts = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FilterLayout b={bindings}>
      <section className="min-w-0 flex-1" aria-label={label}>
        <h1 className="sr-only">{label}</h1>

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
    </FilterLayout>
  );
}
