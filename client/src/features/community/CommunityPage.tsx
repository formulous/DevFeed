import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { ProfileRail } from '@/components/profile/ProfileCard';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { parseCategory } from '@/lib/community';
import { communityListQuery } from './queries';
import { WriteButton } from './WriteButton';

export function CommunityPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const category = parseCategory(params.get('category'));
  const list = useInfiniteQuery({ ...communityListQuery(category?.api ?? null, status), enabled: status !== 'loading' });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();
  const sentinelRef = useInfiniteScroll(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  }, list.hasNextPage && !list.isError);
  const posts = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <ProfileRail>
      <section aria-label="커뮤니티 최신 글">
        {list.isPending ? (
          <div>
            {Array.from({ length: 5 }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : list.isError && posts.length === 0 ? (
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState title="아직 글이 없어요" description="첫 글을 남겨 보세요" action={<WriteButton />} />
        ) : (
          <ul className="divide-y divide-line">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} summaryLines={2} onOpen={openPost} onToggleBookmark={toggleBookmark} />
              </li>
            ))}
          </ul>
        )}
        <div ref={sentinelRef} />
        {list.isFetchingNextPage && <PostCardSkeleton />}
        {list.isError && posts.length > 0 && (
          <div className="mt-3 text-center">
            <button type="button" onClick={() => list.fetchNextPage()} className="text-sm text-brand">
              더 불러오지 못했어요. 다시 시도
            </button>
          </div>
        )}
      </section>
    </ProfileRail>
  );
}
