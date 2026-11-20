import { cn } from '@/lib/cn';
import type { SegmentOption } from './types';

interface SegmentProps {
  legend: string;
  options: SegmentOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function Segment({ legend, options, value, onChange }: SegmentProps) {
  return (
    <div role="radiogroup" aria-label={legend} className="flex rounded-full border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 flex-1 rounded-full text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
            value === o.value ? 'bg-subtle-strong font-semibold text-fg' : 'text-fg-secondary hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
