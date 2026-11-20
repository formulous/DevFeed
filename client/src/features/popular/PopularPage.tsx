import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import type { PopularPeriod } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { popularQuery } from '@/features/feed/queries';
import { parseField } from '@/lib/fields';

export const PERIODS: { value: PopularPeriod; label: string }[] = [
  { value: 'DAY', label: '24시간' },
  { value: 'WEEK', label: '7일' },
  { value: 'MONTH', label: '30일' },
];

export const DEFAULT_PERIOD: PopularPeriod = 'WEEK';

export function parsePeriod(value: string | null): PopularPeriod {
  return PERIODS.some((p) => p.value === value) ? (value as PopularPeriod) : DEFAULT_PERIOD;
}

export function PopularPage() {
  const { status } = useAuth();
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get('period'));
  const field = parseField(params.get('field'));
  const popular = useQuery({ ...popularQuery(period, field?.api ?? null, status), enabled: status !== 'loading' });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();

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

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">인기 글{field && <span className="ml-1.5 font-medium text-fg-secondary">· {field.label}</span>}</h2>
        <div role="radiogroup" aria-label="기간" className="flex rounded-full border border-line p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={period === p.value}
              onClick={() => select(p.value)}
              className={cn(
                'rounded-full px-3 py-1 text-sm',
                period === p.value ? 'bg-inverse text-on-inverse' : 'text-fg-secondary hover:text-fg',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-fg-muted">최근 {PERIODS.find((p) => p.value === period)?.label} 동안 발행된 글 중 많이 읽힌 순 · 최대 10분 지연</p>

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
          title="이 기간에 읽힌 글이 아직 없음"
          description={period === 'MONTH' ? '최신 글부터 둘러보셈' : '기간을 늘리거나 최신 글을 둘러보셈'}
          action={
            <Link to="/" className="text-sm font-medium text-brand">
              최신 피드 보기
            </Link>
          }
        />
      ) : (
        <ol className="divide-y divide-line" aria-label="인기 글 순위">
          {popular.data.items.map((post, i) => (
            <li key={post.id} className="flex gap-3">
              <span
                className={cn(
                  'w-6 shrink-0 pt-[18px] text-right text-lg font-bold tabular-nums',
                  i < 3 ? 'text-fg' : 'text-fg-muted',
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <PostCard
                  post={post}
                  badges="new"
                  onOpen={openPost}
                  onToggleBookmark={toggleBookmark}
                  meta={`조회 ${formatNumber(post.viewCount)}`}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
