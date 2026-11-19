import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import type { SearchPeriod } from '@/api/search';
import { CheckList } from '@/components/filters/CheckList';
import { sourcesQuery, tagsQuery } from '@/features/feed/queries';
import { useSearchState } from '@/hooks/useSearchState';

export const SEARCH_PERIODS: { value: SearchPeriod; label: string }[] = [
  { value: '1W', label: '1주' },
  { value: '1M', label: '1개월' },
  { value: '1Y', label: '1년' },
  { value: 'ALL', label: '전체' },
];

export function SearchSidebar() {
  const { state, toggleTag, toggleSource, setPeriod } = useSearchState();
  const tags = useQuery(tagsQuery);
  const sources = useQuery(sourcesQuery);
  const tagItems = useMemo(
    () => (tags.data ?? []).map((t) => ({ id: t.id, name: t.name, count: t.postCount })),
    [tags.data],
  );

  return (
    <div className="space-y-6 rounded-[var(--radius-md)] border border-line bg-surface p-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">기간</legend>
        <div className="grid grid-cols-2 gap-1">
          {SEARCH_PERIODS.map((p) => (
            <label key={p.value} className="flex cursor-pointer items-center gap-1 text-sm">
              <input
                type="radio"
                name="searchPeriod"
                checked={state.period === p.value}
                onChange={() => setPeriod(p.value)}
                className="accent-[var(--color-primary)]"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <CheckList legend="태그" items={tagItems} selected={state.tagIds} max={MAX_TAG_FILTER} onToggle={toggleTag} />
      <CheckList
        legend="소스"
        items={sources.data ?? []}
        selected={state.sourceIds}
        max={MAX_SOURCE_FILTER}
        onToggle={toggleSource}
      />
    </div>
  );
}
