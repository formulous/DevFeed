import { FiHeart, FiMessageCircle } from 'react-icons/fi';
import type { PostSummary } from '@/api/types';
import { useToggleLike } from '@/hooks/usePostActions';
import { cn } from '@/lib/cn';
import { compactNumber, formatNumber } from '@/lib/format';

const BTN =
  'relative z-10 inline-flex items-center gap-1 rounded px-1.5 py-1 tabular-nums hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring';

export function ReactionBar({
  post,
  open,
  controls,
  onToggleComments,
}: {
  post: PostSummary;
  open: boolean;
  controls: string;
  onToggleComments: () => void;
}) {
  const toggleLike = useToggleLike();
  const likes = post.likeCount ?? 0;
  const comments = post.commentCount ?? 0;
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => toggleLike(post)}
        aria-pressed={!!post.likedByMe}
        aria-label={`좋아요 ${formatNumber(likes)}개`}
        className={cn(BTN, post.likedByMe ? 'text-hot' : 'text-fg-muted hover:text-fg')}
      >
        <FiHeart size={14} fill={post.likedByMe ? 'currentColor' : 'none'} aria-hidden />
        <span>{compactNumber(likes)}</span>
      </button>
      <button
        type="button"
        onClick={onToggleComments}
        aria-expanded={open}
        aria-controls={controls}
        aria-label={`댓글 ${formatNumber(comments)}개`}
        className={cn(BTN, open ? 'text-fg' : 'text-fg-muted hover:text-fg')}
      >
        <FiMessageCircle size={14} aria-hidden />
        <span>{compactNumber(comments)}</span>
      </button>
    </span>
  );
}
