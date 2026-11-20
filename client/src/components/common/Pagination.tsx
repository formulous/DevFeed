import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { cn } from '@/lib/cn';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  window?: number;
}

export function pageWindow(page: number, totalPages: number, size: number) {
  const half = Math.floor(size / 2);
  const start = Math.max(1, Math.min(page - half, totalPages - size + 1));
  const end = Math.min(totalPages, start + size - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({ page, totalPages, onChange, window = 5 }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages, window);
  const btn = 'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm';

  return (
    <nav aria-label="페이지" className="mt-6 flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={cn(btn, 'text-fg-secondary hover:bg-subtle disabled:opacity-40')}
      >
        <FiChevronLeft />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
          className={cn(btn, p === page ? 'bg-inverse font-semibold text-on-inverse' : 'text-fg-secondary hover:bg-subtle')}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="다음 페이지"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={cn(btn, 'text-fg-secondary hover:bg-subtle disabled:opacity-40')}
      >
        <FiChevronRight />
      </button>
    </nav>
  );
}
