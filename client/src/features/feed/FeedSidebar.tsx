import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import type { SourceType } from '@/api/types';
import { useFeedFilters } from '@/hooks/useFeedFilters';
import { sourcesQuery, tagsQuery } from './queries';

const VISIBLE = 10;

interface CheckListProps {
  legend: string;
  items: { id: number; name: string; count?: number }[];
  selected: number[];
  max: number;
  onToggle: (id: number) => void;
}

function CheckList({ legend, items, selected, max, onToggle }: CheckListProps) {
  const full = selected.length >= max;
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState(false);
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return k ? items.filter((i) => i.name.toLowerCase().includes(k)) : items;
  }, [items, keyword]);
  const visible = expanded || keyword ? filtered : filtered.slice(0, VISIBLE);

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={`${legend} 검색`}
        aria-label={`${legend} 검색`}
        className="mb-2 h-8 w-full rounded-md border border-line px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200/40"
      />
      {full && <p className="mb-1 text-xs text-fg-muted">{legend}는 최대 {max}개까지 고를 수 있음</p>}
      <ul className="space-y-1">
        {visible.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={full && !selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="accent-[var(--color-primary)]"
              />
              <span className="truncate">{item.name}</span>
              {item.count !== undefined && <span className="ml-auto text-xs text-fg-muted">{item.count}</span>}
            </label>
          </li>
        ))}
      </ul>
      {!keyword && filtered.length > VISIBLE && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs text-brand">
          {expanded ? '접기' : `더보기 (${filtered.length - VISIBLE})`}
        </button>
      )}
    </fieldset>
  );
}

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
