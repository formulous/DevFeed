import { useEffect, useId, useRef, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md';
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-md' } as const;

export function Modal({ open, onClose, title, children, size = 'sm' }: ModalProps) {
  const titleId = useId();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full ${WIDTH[size]} flex-col rounded-[var(--radius-lg)] border border-line bg-surface shadow-pop outline-none`}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-fg-muted hover:text-fg">
            <FiX size={18} />
          </button>
        </div>
        <div className="scrollbar-thin min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
