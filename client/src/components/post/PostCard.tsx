import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CommentSection } from '@/components/comments/CommentSection';
import { ReactionBar } from '@/components/post/ReactionBar';
import { FiStar } from 'react-icons/fi';
import type { PostSummary } from '@/api/types';
import { PostBadges, type BadgeMode } from '@/components/post/PostBadges';
import { Highlight } from '@/components/common/Highlight';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/time';
import { communityPostPath } from '@/lib/routes';
import { Avatar } from '@/components/profile/Avatar';
import { GradeBadge } from '@/components/profile/GradeBadge';
import { CategoryBadge, SolvedBadge } from './CommunityBadges';

interface PostCardProps {
  post: PostSummary;
  query?: string;
  onOpen: (post: PostSummary) => void;
  onToggleBookmark: (post: PostSummary) => void;
  meta?: ReactNode;
  badges?: BadgeMode;
  summaryLines?: 2 | 3;
  kicker?: ReactNode;
  reactions?: boolean;
  emphasize?: 'likes' | 'comments';
}

function ExternalImage({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={cn(className, 'bg-subtle')} aria-hidden />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(className, 'object-cover')}
    />
  );
}

export function PostCard({
  post,
  query,
  onOpen,
  onToggleBookmark,
  meta,
  badges = 'all',
  summaryLines = 3,
  kicker,
  reactions = true,
  emphasize,
}: PostCardProps) {
  const [open, setOpen] = useState(false);
  const showReactions = reactions && post.likeCount !== undefined;
  const commentsId = `comments-${post.id}`;
  const info = post.kind === 'COMMUNITY' ? post.community : undefined;
  const detailPath = info ? communityPostPath(post.id) : null;
  const titleCls = "after:absolute after:inset-0 after:content-[''] hover:text-brand";
  return (
    <div>
      <article
        className={cn('relative px-3 py-5 transition-colors duration-150 hover:bg-hover sm:px-4', post.isRead && 'opacity-60')}
      >
        {kicker}
        <div className="flex items-center gap-2 text-xs text-fg-secondary">
          {info ? (
            <>
              <CategoryBadge category={info.category} />
              {info.solved && <SolvedBadge />}
              {info.author && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <Avatar nickname={info.author.nickname} size={20} />
                  <span className="truncate font-medium">{info.author.nickname}</span>
                  <span className="hidden sm:inline-flex">
                    <GradeBadge grade={info.author.grade} small />
                  </span>
                </span>
              )}
            </>
          ) : (
            <>
              {post.source.logoUrl && <ExternalImage src={post.source.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded" />}
              <span className="truncate font-medium">{post.source.name}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <time dateTime={post.publishedAt} className="shrink-0">
            {relativeTime(post.publishedAt)}
          </time>
          {!info && <PostBadges post={post} mode={badges} />}
          <button
            type="button"
            onClick={() => onToggleBookmark(post)}
            aria-pressed={!!post.isBookmarked}
            aria-label={post.isBookmarked ? '북마크 해제' : '북마크'}
            className={cn(
              'relative z-10 ml-auto rounded p-1 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
              post.isBookmarked ? 'text-warn' : 'text-fg-muted',
            )}
          >
            <FiStar size={18} fill={post.isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="mt-2 flex gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-[-0.01em] text-fg">
              {detailPath ? (
                <Link to={detailPath} className={titleCls}>
                  <Highlight text={post.title} query={query} />
                </Link>
              ) : (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOpen(post)}
                  onAuxClick={(e) => e.button === 1 && onOpen(post)}
                  className={titleCls}
                >
                  <Highlight text={post.title} query={query} />
                </a>
              )}
            </h3>
            {post.summary && (
              <p
                className={cn(
                  'mt-1.5 text-sm leading-relaxed text-fg-secondary',
                  summaryLines === 2 ? 'line-clamp-2' : 'line-clamp-3',
                )}
              >
                <Highlight text={post.summary} query={query} />
              </p>
            )}
          </div>
          {post.thumbnailUrl && (
            <ExternalImage
              src={post.thumbnailUrl}
              alt=""
              className="hidden h-20 w-28 shrink-0 rounded-[var(--radius-sm)] sm:block"
            />
          )}
        </div>

        {(post.tags.length > 0 || meta || showReactions) && (
          <div className="mt-3 flex items-center gap-3 text-xs text-fg-muted">
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag.id}>#{tag.name}</li>
              ))}
            </ul>
            <span className="-my-1 ml-auto flex shrink-0 items-center gap-3">
              {meta && <span>{meta}</span>}
              {showReactions && (
                <ReactionBar
                  post={post}
                  emphasize={emphasize}
                  open={open}
                  controls={commentsId}
                  onToggleComments={() => setOpen((v) => !v)}
                  commentsTo={detailPath ? `${detailPath}#comments` : undefined}
                />
              )}
            </span>
          </div>
        )}
      </article>
      {showReactions && open && <CommentSection post={post} id={commentsId} />}
    </div>
  );
}
