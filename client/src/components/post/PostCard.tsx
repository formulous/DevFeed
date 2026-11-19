import { useState } from 'react';
import { FiStar } from 'react-icons/fi';
import type { PostSummary } from '@/api/types';
import { Highlight } from '@/components/common/Highlight';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/time';

interface PostCardProps {
  post: PostSummary;
  query?: string;
  onOpen: (post: PostSummary) => void;
  onToggleBookmark: (post: PostSummary) => void;
}

function ExternalImage({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={cn(className, 'bg-slate-100')} aria-hidden />;
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

export function PostCard({ post, query, onOpen, onToggleBookmark }: PostCardProps) {
  return (
    <article
      className={cn(
        'relative rounded-[var(--radius-md)] border border-line bg-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]',
        post.isRead && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-fg-secondary">
        <ExternalImage src={post.source.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded" />
        <span className="truncate font-medium">{post.source.name}</span>
        <span aria-hidden>·</span>
        <time dateTime={post.publishedAt} className="shrink-0">
          {relativeTime(post.publishedAt)}
        </time>
        <button
          type="button"
          onClick={() => onToggleBookmark(post)}
          aria-pressed={!!post.isBookmarked}
          aria-label={post.isBookmarked ? '북마크 해제' : '북마크'}
          className={cn(
            'relative z-10 ml-auto rounded p-1 hover:bg-slate-100',
            post.isBookmarked ? 'text-amber-500' : 'text-fg-muted',
          )}
        >
          <FiStar size={18} fill={post.isBookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="mt-2 flex gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpen(post)}
              onAuxClick={(e) => e.button === 1 && onOpen(post)}
              className="after:absolute after:inset-0 after:content-[''] hover:text-brand"
            >
              <Highlight text={post.title} query={query} />
            </a>
          </h3>
          {post.summary && (
            <p className="mt-1 line-clamp-3 text-sm text-fg-secondary">
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

      {post.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-fg-muted">
          {post.tags.map((tag) => (
            <li key={tag.id}>#{tag.name}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
