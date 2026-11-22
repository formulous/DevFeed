import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import { SEARCH_MAX_PAGE, type SearchPeriod, type SearchQuery, type SearchSort } from '@/api/search';
import { SEARCH_MAX, SEARCH_MIN } from '@/components/layout/AppHeader';
import type { FilterBindings, SegmentOption } from '@/components/filters/types';
import type { CommunityCategory, NewsRegion } from '@/api/types';
import { parseCategory } from '@/lib/community';
import { DEFAULT_SCOPE, parseScope, type SearchScopeKey } from '@/lib/searchScope';

const REGIONS: NewsRegion[] = ['DOMESTIC', 'OVERSEAS'];

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
  const scope = parseScope(params.get('scope'));
  const region = params.get('region') as NewsRegion;
  return {
    q: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX),
    scope,
    tagIds: scope === 'tech' ? parseIds(params.get('tagIds'), MAX_TAG_FILTER) : [],
    sourceIds: scope === 'tech' ? parseIds(params.get('sourceIds'), MAX_SOURCE_FILTER) : [],
    region: scope === 'security' && REGIONS.includes(region) ? region : null,
    category: scope === 'community' ? (parseCategory(params.get('category'))?.api ?? null) : null,
    period: PERIODS.includes(period) ? period : 'ALL',
    sort: SORTS.includes(sort) ? sort : 'RELEVANCE',
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, SEARCH_MAX_PAGE) : 1,
  };
}

export function toSearchParams(s: SearchQuery) {
  const next = new URLSearchParams();
  next.set('q', s.q);
  if (s.scope !== DEFAULT_SCOPE) next.set('scope', s.scope);
  if (s.region) next.set('region', s.region);
  if (s.category) next.set('category', s.category.toLowerCase());
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
    setTags: (tagIds: number[]) => update({ tagIds }),
    setSources: (sourceIds: number[]) => update({ sourceIds }),
    setPeriod: (period: SearchPeriod) => update({ period }),
    setSort: (sort: SearchSort) => update({ sort }),
    setRegion: (region: NewsRegion | null) => update({ region }),
    setCategory: (category: CommunityCategory | null) => update({ category }),
    scopeHref: (scope: SearchScopeKey) =>
      `/search?${toSearchParams({ ...state, scope, tagIds: [], sourceIds: [], region: null, category: null, page: 1 }).toString()}`,
    setPage: (page: number) => update({ page }, true),
    resetFilters: () => update({ tagIds: [], sourceIds: [], region: null, category: null, period: 'ALL' }),
  };
}

export const SEARCH_PERIODS: SegmentOption[] = [
  { value: 'ALL', label: '전체' },
  { value: '1W', label: '1주' },
  { value: '1M', label: '1개월' },
  { value: '1Y', label: '1년' },
];

export function useSearchFilterBindings(): FilterBindings {
  const s = useSearchState();
  return {
    tagIds: s.state.tagIds,
    sourceIds: s.state.sourceIds,
    setTags: s.setTags,
    setSources: s.setSources,
    toggleTag: s.toggleTag,
    toggleSource: s.toggleSource,
    segment: {
      legend: '기간',
      options: SEARCH_PERIODS,
      value: s.state.period,
      onChange: (v) => s.setPeriod((v ?? 'ALL') as SearchPeriod),
    },
    reset: s.resetFilters,
  };
}
