import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { PeriodPicker, periodLabel, RankedPosts } from '@/components/post/RankedPosts';
import { ProfileRail } from '@/components/profile/ProfileCard';
import { usePeriodParam } from '@/features/popular/PopularPage';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { parseCategory } from '@/lib/community';
import { communityPopularQuery } from './queries';
import { WriteButton } from './WriteButton';

export function CommunityPopularPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const [period, select] = usePeriodParam();
  const category = parseCategory(params.get('category'));
  const popular = useQuery({
    ...communityPopularQuery(period, category?.api ?? null, status),
    enabled: status !== 'loading',
  });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();

  return (
    <ProfileRail>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            인기 글{category && <span className="ml-1.5 font-medium text-fg-secondary">· {category.label}</span>}
          </h2>
          <PeriodPicker value={period} onChange={select} />
        </div>
        <p className="mb-3 text-xs text-fg-muted">
          최근 {periodLabel(period)} 동안 올라온 글을 좋아요·댓글·조회 순으로 보여드려요 · 최대 10분 늦게 반영돼요
        </p>
        {popular.isPending ? (
          <div>
            {Array.from({ length: 5 }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : popular.isError ? (
          <ErrorState message={popular.error.message} onRetry={() => popular.refetch()} />
        ) : popular.data.items.length === 0 ? (
          <EmptyState title="이 기간에 올라온 글이 없어요" description="기간을 늘리거나 첫 글을 남겨 보세요" action={<WriteButton />} />
        ) : (
          <RankedPosts
            label="커뮤니티 인기 글 순위"
            items={popular.data.items}
            summaryLines={2}
            onOpen={openPost}
            onToggleBookmark={toggleBookmark}
          />
        )}
      </section>
    </ProfileRail>
  );
}
