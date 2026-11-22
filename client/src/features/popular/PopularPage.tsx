import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import type { PopularPeriod, TechRankSort } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { DEFAULT_PERIOD, parsePeriod, PeriodPicker, periodLabel, RankedPosts } from '@/components/post/RankedPosts';
import { ProfileRail } from '@/components/profile/ProfileCard';
import { popularQuery } from '@/features/feed/queries';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { parseField } from '@/lib/fields';
import { PATHS } from '@/lib/routes';

export { DEFAULT_PERIOD, parsePeriod, PERIODS } from '@/components/post/RankedPosts';

export function usePeriodParam() {
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get('period'));
  const select = (value: PopularPeriod) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === DEFAULT_PERIOD) next.delete('period');
        else next.set('period', value);
        return next;
      },
      { replace: true },
    );
  return [period, select] as const;
}

const COPY: Record<TechRankSort, { title: string; label: string; basis: string; empty: string }> = {
  VIEWS: { title: '인기 글', label: '인기 글 순위', basis: '많이 읽힌 순으로', empty: '이 기간에 읽힌 글이 아직 없어요' },
  COMMENTS: { title: '댓글 많은 글', label: '댓글 많은 글 순위', basis: '댓글이 많은 순으로', empty: '이 기간에 댓글이 달린 글이 아직 없어요' },
};

export function PopularPage({ sort = 'VIEWS' }: { sort?: TechRankSort }) {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const [period, select] = usePeriodParam();
  const field = parseField(params.get('field'));
  const copy = COPY[sort];
  const popular = useQuery({
    ...popularQuery(period, field?.api ?? null, status, sort),
    enabled: status !== 'loading',
  });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();
  const latest = field ? `${PATHS.tech}?field=${field.key}` : PATHS.tech;

  return (
    <ProfileRail>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            {copy.title}{field && <span className="ml-1.5 font-medium text-fg-secondary">· {field.name}</span>}
          </h2>
          <PeriodPicker value={period} onChange={select} />
        </div>
        <p className="mb-3 text-xs text-fg-muted">
          최근 {periodLabel(period)} 동안 발행된 글을 {copy.basis} 보여드려요 · 최대 10분 늦게 반영돼요
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
          <EmptyState
            title={copy.empty}
            description={period === 'MONTH' ? '최신 글부터 둘러보세요' : '기간을 늘리거나 최신 글을 둘러보세요'}
            action={
              <Link to={latest} className="text-sm font-medium text-brand">
                최신 피드 보기
              </Link>
            }
          />
        ) : (
          <RankedPosts
            label={copy.label}
            items={popular.data.items}
            metric={sort === 'COMMENTS' ? 'comments' : 'views'}
            onOpen={openPost}
            onToggleBookmark={toggleBookmark}
          />
        )}
      </section>
    </ProfileRail>
  );
}
