import { useMemo, useState } from 'react';

const VISIBLE = 10;

export interface CheckListProps {
  legend: string;
  items: { id: number; name: string; count?: number }[];
  selected: number[];
  max: number;
  onToggle: (id: number) => void;
}

export function CheckList({ legend, items, selected, max, onToggle }: CheckListProps) {
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
