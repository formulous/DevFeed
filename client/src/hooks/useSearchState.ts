import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import { SEARCH_MAX_PAGE, type SearchPeriod, type SearchQuery, type SearchSort } from '@/api/search';
import { SEARCH_MAX, SEARCH_MIN } from '@/components/layout/AppHeader';

const PERIODS: SearchPeriod[] = ['1W', '1M', '1Y', 'ALL'];
const SORTS: SearchSort[] = ['RELEVANCE', 'LATEST'];

function parseIds(value: string | null, max: number) {
  if (!value) return [];
  const ids = value
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return Array.from(new Set(ids)).slice(0, max);
}

export function parseSearch(params: URLSearchParams): SearchQuery {
  const period = params.get('period') as SearchPeriod;
  const sort = params.get('sort') as SearchSort;
  const page = Number(params.get('page'));
  return {
    q: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX),
    tagIds: parseIds(params.get('tagIds'), MAX_TAG_FILTER),
    sourceIds: parseIds(params.get('sourceIds'), MAX_SOURCE_FILTER),
    period: PERIODS.includes(period) ? period : 'ALL',
    sort: SORTS.includes(sort) ? sort : 'RELEVANCE',
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, SEARCH_MAX_PAGE) : 1,
  };
}

export function toSearchParams(s: SearchQuery) {
  const next = new URLSearchParams();
  next.set('q', s.q);
  if (s.tagIds.length) next.set('tagIds', s.tagIds.join(','));
  if (s.sourceIds.length) next.set('sourceIds', s.sourceIds.join(','));
  if (s.period !== 'ALL') next.set('period', s.period);
  if (s.sort !== 'RELEVANCE') next.set('sort', s.sort);
  if (s.page > 1) next.set('page', String(s.page));
  return next;
}

export function isValidQuery(q: string) {
  return q.length >= SEARCH_MIN && q.length <= SEARCH_MAX;
}

function toggle(list: number[], id: number) {
  return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
}

export function useSearchState() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseSearch(params), [params]);

  const update = useCallback(
    (patch: Partial<SearchQuery>, keepPage = false) => {
      setParams((prev) => {
        const current = parseSearch(prev);
        return toSearchParams({ ...current, ...patch, page: keepPage ? (patch.page ?? current.page) : 1 });
      });
    },
    [setParams],
  );

  return {
    state,
    toggleTag: (id: number) => update({ tagIds: toggle(state.tagIds, id) }),
    toggleSource: (id: number) => update({ sourceIds: toggle(state.sourceIds, id) }),
    setPeriod: (period: SearchPeriod) => update({ period }),
    setSort: (sort: SearchSort) => update({ sort }),
    setPage: (page: number) => update({ page }, true),
    resetFilters: () => update({ tagIds: [], sourceIds: [], period: 'ALL' }),
  };
}
