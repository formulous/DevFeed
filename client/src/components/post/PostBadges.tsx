import type { PostSummary } from '@/api/types';
import { isNewPost } from '@/lib/time';

export type BadgeMode = 'all' | 'new' | 'none';

const BASE = 'inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[11px] font-semibold leading-4';

export function PostBadges({ post, mode }: { post: PostSummary; mode: BadgeMode }) {
  if (mode === 'none') return null;
  const showNew = isNewPost(post.publishedAt);
  const showPopular = mode === 'all' && post.isPopular === true;
  if (!showNew && !showPopular) return null;
  return (
    <span className="flex shrink-0 items-center gap-1" data-testid="post-badges">
      {showNew && <span className={`${BASE} bg-brand-soft text-blue-700`}>NEW</span>}
      {showPopular && <span className={`${BASE} bg-orange-50 text-orange-700`}>인기</span>}
    </span>
  );
}
