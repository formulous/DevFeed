import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER, type FeedQuery } from '@/api/posts';
import type { SourceType } from '@/api/types';

function parseIds(value: string | null, max: number) {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ).slice(0, max);
}

export function parseFeedFilters(params: URLSearchParams): FeedQuery {
  const type = params.get('sourceType');
  return {
    tagIds: parseIds(params.get('tagIds'), MAX_TAG_FILTER),
    sourceIds: parseIds(params.get('sourceIds'), MAX_SOURCE_FILTER),
    sourceType: type === 'COMPANY' || type === 'PERSONAL' ? type : null,
  };
}

export function applyFeedFilters(params: URLSearchParams, filters: FeedQuery) {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
  setOrDelete('tagIds', filters.tagIds.join(','));
  setOrDelete('sourceIds', filters.sourceIds.join(','));
  setOrDelete('sourceType', filters.sourceType ?? '');
  return next;
}

function toggle(list: number[], id: number) {
  return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
}

export function useFeedFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFeedFilters(params), [params]);

  const update = useCallback(
    (fn: (prev: FeedQuery) => FeedQuery) => {
      setParams((prev) => applyFeedFilters(prev, fn(parseFeedFilters(prev))), { replace: true });
    },
    [setParams],
  );

  return {
    filters,
    isEmpty: filters.tagIds.length === 0 && filters.sourceIds.length === 0 && filters.sourceType === null,
    toggleTag: (id: number) => update((f) => ({ ...f, tagIds: toggle(f.tagIds, id) })),
    toggleSource: (id: number) => update((f) => ({ ...f, sourceIds: toggle(f.sourceIds, id) })),
    setSourceType: (sourceType: SourceType | null) => update((f) => ({ ...f, sourceType })),
    reset: () => update(() => ({ tagIds: [], sourceIds: [], sourceType: null })),
  };
}
