import type { GradeRef } from '@/api/types';
import { cn } from '@/lib/cn';

export function GradeBadge({ grade, small = false }: { grade: GradeRef; small?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line font-medium text-fg-secondary',
        small ? 'px-1.5 text-[10px] leading-4' : 'px-2 text-[11px] leading-5',
      )}
    >
      <span className="text-fg">Lv.{grade.level}</span>
      {grade.name}
    </span>
  );
}
