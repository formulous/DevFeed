import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';

interface ChipProps {
  label: string;
  onRemove?: () => void;
  className?: string;
}

export function Chip({ label, onRemove, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand',
        className,
      )}
    >
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`${label} 필터 제거`} className="hover:opacity-70">
          <FiX size={12} />
        </button>
      )}
    </span>
  );
}
