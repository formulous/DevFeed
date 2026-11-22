import type { PopularPeriod, PopularPost, PostSummary } from '@/api/types';
import type { BadgeMode } from './PostBadges';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { PostCard } from './PostCard';

export const PERIODS: { value: PopularPeriod; label: string }[] = [
  { value: 'DAY', label: '24시간' },
  { value: 'WEEK', label: '7일' },
  { value: 'MONTH', label: '30일' },
];

export const DEFAULT_PERIOD: PopularPeriod = 'WEEK';

export function parsePeriod(value: string | null): PopularPeriod {
  return PERIODS.some((p) => p.value === value) ? (value as PopularPeriod) : DEFAULT_PERIOD;
}

export function periodLabel(period: PopularPeriod) {
  return PERIODS.find((p) => p.value === period)?.label ?? '';
}

export function PeriodPicker({ value, onChange }: { value: PopularPeriod; onChange: (value: PopularPeriod) => void }) {
  return (
    <div role="radiogroup" aria-label="기간" className="flex rounded-full border border-line p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'whitespace-nowrap rounded-full px-3 py-1 text-sm',
            value === p.value ? 'bg-inverse text-on-inverse' : 'text-fg-secondary hover:text-fg',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

interface RankedPostsProps {
  label: string;
  items: PopularPost[];
  onOpen: (post: PostSummary) => void;
  onToggleBookmark: (post: PostSummary) => void;
  badges?: BadgeMode;
  summaryLines?: 2 | 3;
}

export function RankedPosts({ label, items, onOpen, onToggleBookmark, badges = 'new', summaryLines }: RankedPostsProps) {
  return (
    <ol className="divide-y divide-line" aria-label={label}>
      {items.map((post, i) => (
        <li key={post.id} className="flex gap-3">
          <span
            className={cn('w-6 shrink-0 pt-[18px] text-right text-lg font-bold tabular-nums', i < 3 ? 'text-fg' : 'text-fg-muted')}
            aria-hidden
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <PostCard
              post={post}
              badges={badges}
              summaryLines={summaryLines}
              onOpen={onOpen}
              onToggleBookmark={onToggleBookmark}
              meta={`조회 ${formatNumber(post.viewCount)}`}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
