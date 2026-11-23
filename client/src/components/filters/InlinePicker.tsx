import { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronUp } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import type { PickerItem } from './ChipPickerModal';

export const INLINE_QUICK_COUNT = 20;
export const INLINE_APPLY_DELAY = 300;
export const FILTER_DIALOG_MEDIA = '(min-width: 1024px)';

interface InlinePickerProps {
  id: string;
  noun: string;
  items: PickerItem[];
  groups: string[];
  groupLabel: string;
  selected: number[];
  max: number;
  onChange: (ids: number[]) => void;
  onClose: () => void;
}

const ALL = '전체';

export function InlinePicker({ id, noun, items, groups, groupLabel, selected, max, onChange, onClose }: InlinePickerProps) {
  const [draft, setDraft] = useState(selected);
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [group, setGroup] = useState(ALL);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number[] | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const selectedKey = selected.join(',');

  useEffect(() => {
    if (!timer.current) setDraft(selectedKey ? selectedKey.split(',').map(Number) : []);
  }, [selectedKey]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (pending.current) onChangeRef.current(pending.current);
      }
    },
    [],
  );

  const schedule = (next: number[]) => {
    setDraft(next);
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      pending.current = null;
      onChangeRef.current(next);
    }, INLINE_APPLY_DELAY);
  };

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    setDraft([]);
    onChangeRef.current([]);
  };

  const full = draft.length >= max;
  const toggle = (itemId: number) => schedule(draft.includes(itemId) ? draft.filter((v) => v !== itemId) : [...draft, itemId]);

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (k) return items.filter((i) => (!expanded || group === ALL || i.group === group) && i.name.toLowerCase().includes(k));
    if (expanded) return items.filter((i) => group === ALL || i.group === group);
    const quick = items.slice(0, INLINE_QUICK_COUNT);
    const quickIds = new Set(quick.map((i) => i.id));
    return [...items.filter((i) => draft.includes(i.id) && !quickIds.has(i.id)), ...quick];
  }, [items, keyword, expanded, group, draft]);

  const canExpand = !expanded && items.length > INLINE_QUICK_COUNT;

  return (
    <div
      id={id}
      role="region"
      aria-label={`${noun} 고르기`}
      data-testid="inline-picker"
      className="mb-3 flex max-h-[60dvh] flex-col rounded-[var(--radius-lg)] border border-line bg-surface"
    >
      <div className="shrink-0 space-y-2 px-3 pt-3">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={`${noun} 검색`}
          aria-label={`${noun} 검색`}
          className="h-9 w-full rounded-lg border border-line bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-focus"
        />
        {expanded && groups.length > 0 && (
          <div role="tablist" aria-label={groupLabel} className="flex flex-wrap gap-1">
            {[ALL, ...groups].map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={group === g}
                onClick={() => setGroup(g)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs',
                  group === g ? 'bg-inverse text-on-inverse' : 'bg-subtle text-fg-secondary hover:bg-subtle-strong',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul
        aria-label={`${noun} 선택지`}
        className="scrollbar-thin mt-3 flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto overscroll-contain px-3 pb-2"
      >
        {visible.map((item) => {
          const on = draft.includes(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(item.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  on ? 'border-inverse bg-inverse text-on-inverse' : 'border-line hover:border-line-strong',
                )}
              >
                {item.name}
                {on && ' ✓'}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="text-sm text-fg-muted">일치하는 {noun}가 없어요</li>}
        {canExpand && !keyword.trim() && (
          <li className="flex w-full justify-end">
            <button type="button" onClick={() => setExpanded(true)} className="text-xs font-medium text-fg-secondary hover:text-brand">
              더 보기 ›
            </button>
          </li>
        )}
      </ul>
      {full && <p className="shrink-0 px-3 pb-1 text-xs text-fg-muted">{noun}는 최대 {max}개까지 고를 수 있어요</p>}
      <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2 text-xs">
        <span className="tabular-nums text-fg-secondary" aria-live="polite">
          선택 {draft.length}/{max}
        </span>
        <span aria-hidden className="text-fg-muted">
          ·
        </span>
        <button type="button" onClick={reset} disabled={draft.length === 0} className="text-fg-secondary hover:text-brand disabled:opacity-40">
          초기화
        </button>
        <button type="button" onClick={onClose} className="ml-auto flex items-center gap-1 font-medium text-fg-secondary hover:text-fg">
          접기
          <FiChevronUp size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
}
