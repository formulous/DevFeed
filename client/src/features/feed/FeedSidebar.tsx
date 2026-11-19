import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { CheckList } from '@/components/filters/CheckList';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import type { SourceType } from '@/api/types';
import { useFeedFilters } from '@/hooks/useFeedFilters';
import { sourcesQuery, tagsQuery } from './queries';

const SOURCE_TYPES: { value: SourceType | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'COMPANY', label: '기업' },
  { value: 'PERSONAL', label: '개인' },
];

export function FeedSidebar() {
  const { filters, toggleTag, toggleSource, setSourceType } = useFeedFilters();
  const tags = useQuery(tagsQuery);
  const sources = useQuery(sourcesQuery);

  const tagItems = useMemo(
    () => (tags.data ?? []).map((t) => ({ id: t.id, name: t.name, count: t.postCount })),
    [tags.data],
  );

  return (
    <div className="space-y-6 rounded-[var(--radius-md)] border border-line bg-surface p-4">
      <CheckList legend="태그" items={tagItems} selected={filters.tagIds} max={MAX_TAG_FILTER} onToggle={toggleTag} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">소스 유형</legend>
        <div className="flex gap-3">
          {SOURCE_TYPES.map((opt) => (
            <label key={opt.label} className="flex cursor-pointer items-center gap-1 text-sm">
              <input
                type="radio"
                name="sourceType"
                checked={filters.sourceType === opt.value}
                onChange={() => setSourceType(opt.value)}
                className="accent-[var(--color-primary)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>
      <CheckList legend="소스" items={sources.data ?? []} selected={filters.sourceIds} max={MAX_SOURCE_FILTER} onToggle={toggleSource} />
    </div>
  );
}
