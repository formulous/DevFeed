import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export interface PickerItem {
  id: number;
  name: string;
  group: string;
  count?: number;
}

interface ChipPickerModalProps {
  open: boolean;
  title: string;
  noun: string;
  items: PickerItem[];
  groups: string[];
  groupLabel: string;
  initial: number[];
  max: number;
  onApply: (ids: number[]) => void;
  onClose: () => void;
}

const ALL = '전체';
const FOCUSABLE = 'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

function PickerBody({ title, noun, items, groups, groupLabel, initial, max, onApply, onClose }: Omit<ChipPickerModalProps, 'open'>) {
  const [draft, setDraft] = useState(initial);
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState(ALL);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const full = draft.length >= max;

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return items.filter((i) => (group === ALL || i.group === group) && (!k || i.name.toLowerCase().includes(k)));
  }, [items, keyword, group]);

  const toggle = (id: number) => setDraft((d) => (d.includes(id) ? d.filter((v) => v !== id) : [...d, id]));

  const trapFocus = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-4">
      <div className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={trapFocus}
        className="relative flex h-[100dvh] w-full flex-col bg-surface shadow-pop lg:border lg:border-line lg:h-auto lg:max-h-[80vh] lg:max-w-[640px] lg:rounded-[var(--radius-lg)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-fg-muted hover:text-fg">
            <FiX size={18} />
          </button>
        </div>
        <div className="space-y-3 px-5 pt-4">
          <input
            ref={searchRef}
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={`${noun} 검색`}
            aria-label={`${noun} 검색`}
            className="h-9 w-full rounded-lg border border-line px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-focus"
          />
          {groups.length > 0 && (
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
          className="scrollbar-thin mt-3 flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto overscroll-contain px-5 pb-4"
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
                  {item.count !== undefined && <span className={cn('ml-1 text-xs', on ? 'opacity-80' : 'text-fg-muted')}>{item.count}</span>}
                  {on && ' ✓'}
                </button>
              </li>
            );
          })}
          {visible.length === 0 && <li className="text-sm text-fg-muted">일치하는 {noun}가 없음</li>}
        </ul>
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <span className="mr-auto text-sm tabular-nums text-fg-secondary" aria-live="polite">
            선택 {draft.length}/{max}
          </span>
          <button type="button" onClick={() => setDraft([])} className="h-9 rounded-lg border border-line px-4 text-sm">
            초기화
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="h-9 rounded-full bg-inverse px-5 text-sm font-medium text-on-inverse hover:opacity-90"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChipPickerModal(props: ChipPickerModalProps) {
  useEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [props.open]);

  if (!props.open) return null;
  const { open: _open, ...rest } = props;
  void _open;
  return createPortal(<PickerBody {...rest} />, document.body);
}
