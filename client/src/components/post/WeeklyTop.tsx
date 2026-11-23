import { queryOptions, useQuery } from '@tanstack/react-query';
import { FiHeart, FiMessageCircle, FiTrendingUp } from 'react-icons/fi';
import { Link } from 'react-router';
import type { PopularPost } from '@/api/types';
import { fetchWeeklyTop, WEEKLY_TOP_SIZE, type TopScope, type WeeklyTopFilter } from '@/api/weeklyTop';
import { POSTS_KEY, useOpenPost } from '@/hooks/usePostActions';
import { cn } from '@/lib/cn';
import { categoryOf } from '@/lib/community';
import { formatNumber } from '@/lib/format';
import { communityPostPath } from '@/lib/routes';

export const weeklyTopQuery = (scope: TopScope, filter: WeeklyTopFilter) =>
  queryOptions({
    queryKey: [...POSTS_KEY, 'weekly-top', scope, filter.field ?? null, filter.region ?? null, filter.category ?? null],
    queryFn: ({ signal }) => fetchWeeklyTop(scope, filter, signal),
    staleTime: 5 * 60_000,
    retry: false,
  });

interface WeeklyTopProps {
  scope: TopScope;
  filter: WeeklyTopFilter;
  moreHref: string;
}

export function topMoreHref(path: string, params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value ? `${path}?${new URLSearchParams({ [key]: value }).toString()}` : path;
}

const BOX = 'mb-4 rounded-[var(--radius-lg)] bg-subtle p-3 sm:p-4';

function Meta({ post }: { post: PopularPost }) {
  return (
    <span className="truncate text-xs text-fg-muted">{post.community ? categoryOf(post.community.category)?.label : post.source.name}</span>
  );
}

function Counts({ post }: { post: PopularPost }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-fg-secondary">
      <span className="flex items-center gap-0.5" aria-label={`좋아요 ${post.likeCount ?? 0}`}>
        <FiHeart size={12} aria-hidden />
        {formatNumber(post.likeCount ?? 0)}
      </span>
      <span className="flex items-center gap-0.5" aria-label={`댓글 ${post.commentCount ?? 0}`}>
        <FiMessageCircle size={12} aria-hidden />
        {formatNumber(post.commentCount ?? 0)}
      </span>
    </span>
  );
}

function TopItem({ post, rank }: { post: PopularPost; rank: number }) {
  const openPost = useOpenPost();
  const body = (
    <>
      <span
        aria-label={`${rank}위`}
        className={cn('w-5 shrink-0 text-lg font-bold leading-none tabular-nums md:w-auto md:text-2xl', rank === 1 ? 'text-brand' : 'text-fg-secondary')}
      >
        {rank}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 md:mt-2">
        <span className="truncate text-sm font-semibold text-fg md:line-clamp-2 md:whitespace-normal">{post.title}</span>
        <span className="hidden md:block">
          <Meta post={post} />
        </span>
      </span>
      <span className="md:mt-auto md:pt-2">
        <Counts post={post} />
      </span>
    </>
  );
  const cls =
    'flex h-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring md:flex-col md:items-start md:gap-0 md:bg-surface md:p-3 md:hover:bg-hover';
  return post.community ? (
    <Link to={communityPostPath(post.id)} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={post.url} target="_blank" rel="noopener noreferrer" onClick={() => openPost(post)} className={cls}>
      {body}
    </a>
  );
}

export function WeeklyTop({ scope, filter, moreHref }: WeeklyTopProps) {
  const top = useQuery(weeklyTopQuery(scope, filter));
  if (top.isError || (top.isSuccess && top.data.items.length === 0)) return null;
  return (
    <section aria-labelledby={`weekly-top-${scope}`} data-testid="weekly-top" className={BOX}>
      <div className="mb-2 flex items-center justify-between">
        <h2 id={`weekly-top-${scope}`} className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <FiTrendingUp size={15} className="text-brand" aria-hidden />
          이번 주 인기
        </h2>
        <Link to={moreHref} className="text-xs font-medium text-fg-secondary hover:text-brand">
          더 보기 ›
        </Link>
      </div>
      {top.isPending ? (
        <ul aria-hidden className="grid grid-cols-1 gap-1 md:grid-cols-3 md:gap-2">
          {Array.from({ length: WEEKLY_TOP_SIZE }, (_, i) => (
            <li key={i} className="h-9 animate-pulse rounded-[var(--radius-md)] bg-subtle-strong md:h-28" />
          ))}
        </ul>
      ) : (
        <ol className="grid grid-cols-1 gap-1 md:grid-cols-3 md:gap-2">
          {top.data.items.slice(0, WEEKLY_TOP_SIZE).map((post, i) => (
            <li key={post.id} className="min-w-0">
              <TopItem post={post} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
