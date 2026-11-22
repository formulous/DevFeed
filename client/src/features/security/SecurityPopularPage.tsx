import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import type { NewsRegion } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Segment } from '@/components/filters/Segment';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { PeriodPicker, periodLabel, RankedPosts } from '@/components/post/RankedPosts';
import { ProfileRail } from '@/components/profile/ProfileCard';
import { usePeriodParam } from '@/features/popular/PopularPage';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { PATHS } from '@/lib/routes';
import { securityPopularQuery } from './queries';
import { REGION_OPTIONS } from './SecurityNewsPage';
import { parseSecurityNews, regionParam } from './useSecurityNewsState';

export function SecurityPopularPage() {
  const { status } = useAuth();
  const [params, setParams] = useSearchParams();
  const [period, selectPeriod] = usePeriodParam();
  const { region } = parseSecurityNews(params);
  const popular = useQuery({ ...securityPopularQuery(period, region, status), enabled: status !== 'loading' });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();

  const setRegion = (value: NewsRegion | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const r = regionParam(value);
        if (r) next.set('region', r);
        else next.delete('region');
        return next;
      },
      { replace: true },
    );

  const latest = (() => {
    const out = new URLSearchParams();
    for (const key of ['region', 'sourceIds']) {
      const v = params.get(key);
      if (v) out.set(key, v);
    }
    const qs = out.toString();
    return qs ? `${PATHS.security}?${qs}` : PATHS.security;
  })();

  return (
    <ProfileRail>
      <section aria-label="인기 보안 뉴스">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="w-full sm:w-auto sm:min-w-[15rem]">
            <Segment legend="지역" options={REGION_OPTIONS} value={region} onChange={(v) => setRegion(v as NewsRegion | null)} />
          </div>
          <PeriodPicker value={period} onChange={selectPeriod} />
        </div>
        <p className="mb-3 text-xs text-fg-muted">
          최근 {periodLabel(period)} 동안 발행된 보안 뉴스를 많이 읽힌 순으로 보여드려요 · 최대 10분 늦게 반영돼요
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
            title="이 기간에 읽힌 보안 뉴스가 아직 없어요"
            description={period === 'MONTH' ? '최신 보안 뉴스부터 둘러보세요' : '기간을 늘리거나 최신 보안 뉴스를 둘러보세요'}
            action={
              <Link to={latest} className="text-sm font-medium text-brand">
                최신 보안 뉴스 보기
              </Link>
            }
          />
        ) : (
          <RankedPosts
            label="인기 보안 뉴스 순위"
            items={popular.data.items}
            onOpen={openPost}
            onToggleBookmark={toggleBookmark}
            summaryLines={2}
          />
        )}
      </section>
    </ProfileRail>
  );
}
