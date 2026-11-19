import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FiFilter, FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';

interface FilterLayoutProps {
  sidebar: ReactNode;
  activeCount: number;
  onReset: () => void;
  children: ReactNode;
}

function FilterDrawer({ open, onClose, onReset, children }: { open: boolean; onClose: () => void; onReset: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="필터"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex h-[100dvh] w-[85%] max-w-sm flex-col bg-app shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <span className="text-base font-semibold">필터</span>
          <button type="button" onClick={onClose} aria-label="필터 닫기" className="text-fg-muted hover:text-fg">
            <FiX size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" data-testid="filter-drawer-body">
          {children}
        </div>
        <div className="flex gap-2 border-t border-line bg-surface p-3">
          <button type="button" onClick={onReset} className="h-10 flex-1 rounded-lg border border-line text-sm">
            초기화
          </button>
          <button type="button" onClick={onClose} className="h-10 flex-[2] rounded-lg bg-brand text-sm font-medium text-white">
            결과 보기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function FilterLayout({ sidebar, activeCount, onReset, children }: FilterLayoutProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex items-center gap-1 self-start text-sm font-medium text-fg-secondary lg:hidden"
      >
        <FiFilter size={14} /> 필터{activeCount > 0 && <span className="text-brand"> {activeCount}</span>}
      </button>
      <aside
        aria-label="필터"
        data-testid="filter-sidebar"
        className="hidden lg:sticky lg:top-28 lg:block lg:max-h-[calc(100dvh-8.5rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain"
      >
        {sidebar}
      </aside>
      <FilterDrawer open={open} onClose={() => setOpen(false)} onReset={onReset}>
        {sidebar}
      </FilterDrawer>
      {children}
    </div>
  );
}
