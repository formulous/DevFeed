import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

const VISIBLE = 10;

export interface CheckListProps {
  legend: string;
  items: { id: number; name: string; count?: number }[];
  selected: number[];
  max: number;
  onToggle: (id: number) => void;
}

export function orderSelectedFirst<T extends { id: number }>(items: T[], selected: number[]) {
  return [...items.filter((i) => selected.includes(i.id)), ...items.filter((i) => !selected.includes(i.id))];
}

export function CheckList({ legend, items, selected, max, onToggle }: CheckListProps) {
  const full = selected.length >= max;
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState(false);
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const list = k ? items.filter((i) => i.name.toLowerCase().includes(k)) : items;
    return orderSelectedFirst(list, selected);
  }, [items, keyword, selected]);
  const collapsedCount = Math.max(VISIBLE, selected.length);
  const showAll = expanded || !!keyword;
  const visible = showAll ? filtered : filtered.slice(0, collapsedCount);

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
      <ul
        aria-label={`${legend} 목록`}
        className={cn('space-y-1', showAll && 'max-h-72 overflow-y-auto overscroll-contain pr-1')}
      >
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
        {keyword && visible.length === 0 && <li className="text-xs text-fg-muted">일치하는 {legend}가 없음</li>}
      </ul>
      {!keyword && filtered.length > collapsedCount && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs text-brand">
          {expanded ? '접기' : `더보기 (${filtered.length - collapsedCount})`}
        </button>
      )}
    </fieldset>
  );
}
