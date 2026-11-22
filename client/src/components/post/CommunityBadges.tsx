import type { CommunityCategory } from '@/api/types';
import { categoryOf } from '@/lib/community';

const BASE = 'inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[11px] font-semibold leading-4';

export function CategoryBadge({ category }: { category: CommunityCategory }) {
  return <span className={`${BASE} border border-line text-fg-secondary`}>{categoryOf(category).label}</span>;
}

export function SolvedBadge() {
  return <span className={`${BASE} bg-success-soft text-success`}>해결됨</span>;
}
