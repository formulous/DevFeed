import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER, type FeedQuery } from '@/api/posts';
import type { SourceType } from '@/api/types';
import type { FilterBindings, SegmentOption } from '@/components/filters/types';
import { parseField } from '@/lib/fields';

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
    field: parseField(params.get('field'))?.api ?? null,
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
    setTags: (tagIds: number[]) => update((f) => ({ ...f, tagIds })),
    setSources: (sourceIds: number[]) => update((f) => ({ ...f, sourceIds })),
    setSourceType: (sourceType: SourceType | null) => update((f) => ({ ...f, sourceType })),
    reset: () => update((f) => ({ ...f, tagIds: [], sourceIds: [], sourceType: null })),
  };
}

const SOURCE_TYPE_OPTIONS: SegmentOption[] = [
  { value: null, label: '전체' },
  { value: 'COMPANY', label: '기업' },
  { value: 'PERSONAL', label: '개인' },
];

export function useFeedFilterBindings(): FilterBindings {
  const f = useFeedFilters();
  const base = {
    tagIds: f.filters.tagIds,
    sourceIds: f.filters.sourceIds,
    setTags: f.setTags,
    setSources: f.setSources,
    toggleTag: f.toggleTag,
    toggleSource: f.toggleSource,
    reset: f.reset,
  };
  return {
    ...base,
    segment: {
      legend: '소스 유형',
      options: SOURCE_TYPE_OPTIONS,
      value: f.filters.sourceType,
      onChange: (v) => f.setSourceType(v as SourceType | null),
    },
  };
}
