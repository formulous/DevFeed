import { categoryLabel } from '@/lib/categories';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tagsQuery } from '@/features/feed/queries';
import { cn } from '@/lib/cn';

const ALL = '전체';
const ETC = '기타';

interface TagPickerProps {
  selected: number[];
  max: number;
  onToggle: (id: number) => void;
}

export function TagPicker({ selected, max, onToggle }: TagPickerProps) {
  const tags = useQuery(tagsQuery);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(ALL);
  const full = selected.length >= max;

  const categories = useMemo(() => {
    const set = new Set((tags.data ?? []).map((t) => (t.category ? categoryLabel(t.category) : ETC)));
    return [ALL, ...Array.from(set).sort((a, b) => (a === ETC ? 1 : b === ETC ? -1 : a.localeCompare(b)))];
  }, [tags.data]);

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return (tags.data ?? []).filter(
      (t) => (category === ALL || ((t.category ? categoryLabel(t.category) : ETC)) === category) && (!k || t.name.toLowerCase().includes(k)),
    );
  }, [tags.data, keyword, category]);

  if (tags.isPending) return <p className="text-sm text-fg-muted">태그를 불러오는 중</p>;
  if (tags.isError) return <p className="text-sm text-danger">태그를 불러오지 못했어요</p>;

  return (
    <div>
      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="태그 검색"
        aria-label="태그 검색"
        className="mb-3 h-9 w-full rounded-lg border border-line px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-focus"
      />
      <div role="tablist" aria-label="분류" className="mb-3 flex flex-wrap gap-1">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              'rounded-full px-3 py-1 text-xs',
              category === c ? 'bg-inverse text-on-inverse' : 'bg-subtle text-fg-secondary hover:bg-subtle-strong',
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="flex max-h-72 flex-wrap gap-2 overflow-y-auto" aria-label="태그 목록">
        {visible.map((t) => {
          const on = selected.includes(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => onToggle(t.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  on ? 'border-inverse bg-inverse text-on-inverse' : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                {t.name}
                {on && ' ✓'}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="text-sm text-fg-muted">일치하는 태그가 없어요</li>}
      </ul>
    </div>
  );
}
