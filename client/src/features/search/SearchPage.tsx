import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { fetchSearch, SEARCH_MAX_PAGE, SEARCH_TOTAL_CAP, type SearchPeriod, type SearchSort } from '@/api/search';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { FilterLayout } from '@/components/filters/FilterLayout';
import { Segment } from '@/components/filters/Segment';
import { ProfileRail } from '@/components/profile/ProfileCard';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { SEARCH_MIN } from '@/components/layout/AppHeader';
import { tagsQuery } from '@/features/feed/queries';
import { POSTS_KEY, useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { isValidQuery, SEARCH_PERIODS, useSearchFilterBindings, useSearchState } from '@/hooks/useSearchState';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { CommunityCategory, NewsRegion } from '@/api/types';
import { CATEGORIES } from '@/lib/community';
import { SEARCH_SCOPES, scopeInfo } from '@/lib/searchScope';
import { REGION_OPTIONS } from '@/features/security/SecurityNewsPage';

const CATEGORY_OPTIONS = [{ value: null, label: '전체' }, ...CATEGORIES.map((c) => ({ value: c.api as string | null, label: c.label }))];

const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: 'RELEVANCE', label: '관련도순' },
  { value: 'LATEST', label: '최신순' },
];

function PopularTags() {
  const tags = useQuery(tagsQuery);
  const top = (tags.data ?? []).slice(0, 10);
  if (top.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label="인기 태그">
      {top.map((t) => (
        <li key={t.id}>
          <Link
            to={`/search?q=${encodeURIComponent(t.name)}`}
            className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand hover:opacity-80"
          >
            #{t.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

type SearchState = ReturnType<typeof useSearchState>;

function ScopeTabs({ s }: { s: SearchState }) {
  return (
    <nav aria-label="검색 범위" data-testid="scope-tabs" className="mb-5 flex items-center gap-2">
      {SEARCH_SCOPES.map((scope, i) => {
        const on = scope.key === s.state.scope;
        return (
          <Fragment key={scope.key}>
            {i > 0 && (
              <span aria-hidden className="select-none text-[13px] text-fg-muted">
                ·
              </span>
            )}
            <Link
              to={s.scopeHref(scope.key)}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-sm py-0.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
                on ? 'font-semibold text-fg' : 'text-fg-secondary hover:text-fg',
              )}
            >
              {scope.label}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}

function ScopeFilters({ s }: { s: SearchState }) {
  const { scope, region, category, period } = s.state;
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row" aria-label="검색 필터">
      <div className="sm:w-60">
        {scope === 'security' ? (
          <Segment legend="지역" options={REGION_OPTIONS} value={region} onChange={(v) => s.setRegion(v as NewsRegion | null)} />
        ) : (
          <Segment legend="말머리" options={CATEGORY_OPTIONS} value={category} onChange={(v) => s.setCategory(v as CommunityCategory | null)} />
        )}
      </div>
      <div className="sm:w-60">
        <Segment legend="기간" options={SEARCH_PERIODS} value={period} onChange={(v) => s.setPeriod((v ?? 'ALL') as SearchPeriod)} />
      </div>
    </div>
  );
}

function OtherScopes({ s }: { s: SearchState }) {
  return (
    <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm">
      {SEARCH_SCOPES.filter((o) => o.key !== s.state.scope).map((o) => (
        <Link key={o.key} to={s.scopeHref(o.key)} className="font-medium text-brand">
          {o.label}에서 검색
        </Link>
      ))}
    </p>
  );
}

export function SearchPage() {
  const s = useSearchState();
  const bindings = useSearchFilterBindings();
  const results = (
    <>
      <ScopeTabs s={s} />
      {s.state.scope !== 'tech' && isValidQuery(s.state.q) && <ScopeFilters s={s} />}
      <SearchResults s={s} />
    </>
  );
  if (s.state.scope === 'tech') {
    return (
      <FilterLayout b={bindings}>
        <section className="min-w-0 flex-1" aria-label="검색 결과">
          {results}
        </section>
      </FilterLayout>
    );
  }
  return (
    <ProfileRail>
      <section aria-label="검색 결과">{results}</section>
    </ProfileRail>
  );
}

function SearchResults({ s }: { s: SearchState }) {
  const { status } = useAuth();
  const { state, setSort, setPage, resetFilters } = s;
  const info = scopeInfo(state.scope);
  const valid = isValidQuery(state.q);
  const search = useQuery({
    queryKey: [...POSTS_KEY, 'search', status, state],
    queryFn: ({ signal }) => fetchSearch(state, signal),
    enabled: valid && status !== 'loading',
    placeholderData: keepPreviousData,
  });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();

  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [state.page]);

  const hasFilters =
    state.tagIds.length > 0 || state.sourceIds.length > 0 || state.region !== null || state.category !== null || state.period !== 'ALL';
  const totalPages = search.data ? Math.min(Math.ceil(search.data.total / search.data.size), SEARCH_MAX_PAGE) : 0;
  const tips: ReactNode = state.scope === 'tech' ? <PopularTags /> : null;

  if (!valid) {
    return (
      <EmptyState
        title={state.q ? `검색어는 ${SEARCH_MIN}자 이상 입력해 주세요` : `${info.label}에서 찾을 검색어를 입력해 주세요`}
        description={info.hint}
        action={tips}
      />
    );
  }
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-base">
          <strong className="break-all">"{state.q}"</strong> 검색 결과{' '}
          {search.data && (
            <span className="text-fg-secondary">
              {search.data.totalCapped
                ? `${formatNumber(SEARCH_TOTAL_CAP)}건 이상`
                : `${formatNumber(search.data.total)}건`}
            </span>
          )}
        </h2>
        <select
          aria-label="정렬"
          value={state.sort}
          onChange={(e) => setSort(e.target.value as SearchSort)}
          className="h-8 rounded-lg border border-line bg-input px-2 text-xs font-bold text-fg focus:outline-none focus:ring-2 focus:ring-brand-focus"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {search.isPending ? (
        <div>
          {Array.from({ length: 5 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : search.isError ? (
        <ErrorState message={search.error.message} onRetry={() => search.refetch()} />
      ) : search.data.items.length === 0 ? (
        <EmptyState
          title={`${info.label}에서 찾지 못했어요`}
          description={
            hasFilters ? '필터를 풀거나 다른 키워드로 검색해 보세요' : '철자를 확인하거나 다른 키워드로 검색해 보세요'
          }
          action={
            <div className="flex flex-col items-center gap-3">
              {hasFilters && (
                <button type="button" onClick={resetFilters} className="text-sm font-medium text-brand">
                  필터 초기화
                </button>
              )}
              {tips}
              <OtherScopes s={s} />
            </div>
          }
        />
      ) : (
        <>
          <ul className={cn('divide-y divide-line', search.isPlaceholderData && 'opacity-60')}>
            {search.data.items.map((post) => (
              <li key={post.id}>
                <PostCard post={post} query={state.q} onOpen={openPost} onToggleBookmark={toggleBookmark} />
              </li>
            ))}
          </ul>
          <Pagination page={state.page} totalPages={totalPages} onChange={setPage} />
          {search.data.totalCapped && state.page === totalPages && (
            <p className="mt-2 text-center text-xs text-fg-muted">상위 1,000건까지만 볼 수 있어요. 검색어나 필터를 좁혀 보세요</p>
          )}
        </>
      )}
    </>
  );
}
