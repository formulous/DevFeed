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
    <div role="radiogroup" aria-label={legend} className="flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 flex-1 rounded-md text-xs transition-colors',
            value === o.value ? 'bg-surface font-semibold text-fg shadow-sm' : 'text-fg-secondary hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
