import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiFilter } from 'react-icons/fi';
import { Link } from 'react-router';
import { fetchSearch, SEARCH_MAX_PAGE, type SearchSort } from '@/api/search';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { SEARCH_MIN } from '@/components/layout/AppHeader';
import { tagsQuery } from '@/features/feed/queries';
import { POSTS_KEY, useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { isValidQuery, useSearchState } from '@/hooks/useSearchState';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { SearchSidebar } from './SearchSidebar';

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

export function SearchPage() {
  const { status } = useAuth();
  const { state, setSort, setPage, resetFilters } = useSearchState();
  const [filterOpen, setFilterOpen] = useState(false);
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

  const hasFilters = state.tagIds.length > 0 || state.sourceIds.length > 0 || state.period !== 'ALL';
  const totalPages = search.data ? Math.min(Math.ceil(search.data.total / search.data.size), SEARCH_MAX_PAGE) : 0;

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
          <SearchSidebar />
        </div>
      </aside>

      <section className="min-w-0 flex-1" aria-label="검색 결과">
        {!valid ? (
          <EmptyState
            title={state.q ? `검색어는 ${SEARCH_MIN}자 이상 입력해야 함` : '검색어를 입력하셈'}
            description="제목·요약·태그·소스 이름에서 찾음"
            action={<PopularTags />}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h1 className="min-w-0 text-base">
                <strong className="break-all">"{state.q}"</strong> 검색 결과{' '}
                {search.data && <span className="text-fg-secondary">{formatNumber(search.data.total)}건</span>}
              </h1>
              <select
                aria-label="정렬"
                value={state.sort}
                onChange={(e) => setSort(e.target.value as SearchSort)}
                className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200/40"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {search.isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <PostCardSkeleton key={i} />
                ))}
              </div>
            ) : search.isError ? (
              <ErrorState message={search.error.message} onRetry={() => search.refetch()} />
            ) : search.data.items.length === 0 ? (
              <EmptyState
                title="검색 결과가 없음"
                description={
                  hasFilters ? '필터를 풀거나 다른 키워드를 써보셈' : '철자를 확인하거나 다른 키워드를 써보셈'
                }
                action={
                  <div className="flex flex-col items-center gap-3">
                    {hasFilters && (
                      <button type="button" onClick={resetFilters} className="text-sm font-medium text-brand">
                        필터 초기화
                      </button>
                    )}
                    <PopularTags />
                  </div>
                }
              />
            ) : (
              <>
                <ul className={cn('space-y-3', search.isPlaceholderData && 'opacity-60')}>
                  {search.data.items.map((post) => (
                    <li key={post.id}>
                      <PostCard post={post} query={state.q} onOpen={openPost} onToggleBookmark={toggleBookmark} />
                    </li>
                  ))}
                </ul>
                <Pagination page={state.page} totalPages={totalPages} onChange={setPage} />
                {search.data.total > SEARCH_MAX_PAGE * search.data.size && state.page === totalPages && (
                  <p className="mt-2 text-center text-xs text-fg-muted">상위 1,000건까지만 볼 수 있음. 검색어나 필터를 좁혀보셈</p>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
