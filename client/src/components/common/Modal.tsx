import { useEffect, useId, useRef, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md';
  variant?: 'dialog' | 'sheet';
  footer?: ReactNode;
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-md' } as const;

export const SHEET_WRAP = 'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4';
export const SHEET_PANEL =
  'sheet-enter relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl border-t border-line bg-surface shadow-pop outline-none sm:rounded-[var(--radius-lg)] sm:border';
export const SAFE_BOTTOM = 'pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3';

export function SheetHandle() {
  return <div aria-hidden data-testid="sheet-handle" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />;
}

export function Modal({ open, onClose, title, children, size = 'sm', variant = 'dialog', footer }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const sheet = variant === 'sheet';

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
    <div className={sheet ? SHEET_WRAP : 'fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-4'}>
      <div className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-variant={variant}
        className={cn(
          sheet
            ? SHEET_PANEL
            : 'relative flex max-h-[calc(100dvh-3rem)] w-full max-w-[320px] flex-col rounded-[var(--radius-lg)] border border-line bg-surface shadow-pop outline-none',
          'sm:max-h-[calc(100dvh-2rem)]',
          WIDTH[size],
        )}
      >
        {sheet && <SheetHandle />}
        <div className={cn('flex shrink-0 items-center justify-between px-5 pb-3', sheet ? 'pt-3 sm:pt-5' : 'pt-5')}>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-fg-muted hover:text-fg">
            <FiX size={18} />
          </button>
        </div>
        <div
          className={cn(
            'scrollbar-thin min-h-0 overflow-y-auto overscroll-contain px-5',
            footer ? 'pb-3' : sheet ? 'pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5' : 'pb-5',
          )}
        >
          {children}
        </div>
        {footer && <div className={cn('flex shrink-0 items-center gap-2 border-t border-line px-5 pt-3', sheet ? SAFE_BOTTOM : 'pb-3')}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
