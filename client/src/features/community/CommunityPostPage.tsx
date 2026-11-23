import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiHeart, FiStar } from 'react-icons/fi';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/http';
import { acceptComment, deleteCommunityPost, setCommunityPostHidden, unacceptComment } from '@/api/community';
import type { Comment, CommunityPost } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { CommentSection, type AcceptControl } from '@/components/comments/CommentSection';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/components/common/Toast';
import { useSeoOverride } from '@/components/layout/RouteTitle';
import { LazyMarkdown } from '@/components/markdown/LazyMarkdown';
import { CategoryBadge, SolvedBadge } from '@/components/post/CommunityBadges';
import { Avatar } from '@/components/profile/Avatar';
import { GradeBadge } from '@/components/profile/GradeBadge';
import { ReportModal } from '@/components/report/ReportModal';
import { POSTS_KEY, useOpenPost, useToggleBookmark, useToggleLike } from '@/hooks/usePostActions';
import { refreshProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { plainExcerpt } from '@/lib/excerpt';
import { compactNumber, formatNumber } from '@/lib/format';
import { communityEditPath, PATHS } from '@/lib/routes';
import { ROBOTS_NOINDEX, SITE_NAME } from '@/lib/seoRoutes';
import { relativeTime } from '@/lib/time';
import { communityPostKey, communityPostQuery } from './queries';

const ACTION = 'text-xs text-fg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-60';

function acceptError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'ACCEPT_OWN_COMMENT') return '내 댓글은 채택할 수 없어요';
    if (error.code === 'ACCEPT_REPLY') return '답글은 채택할 수 없어요';
    if (error.code === 'ACCEPT_NOT_QUESTION') return '질문글에서만 채택할 수 있어요';
    if (error.code === 'NOT_FOUND') return '이미 삭제되거나 숨겨진 댓글이에요';
  }
  return errorMessage(error, '채택을 반영하지 못했어요');
}

function BackLink() {
  return (
    <Link to={PATHS.community} className="inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg">
      <FiArrowLeft size={14} aria-hidden />
      자유 게시판
    </Link>
  );
}

function useViewOnce(post: CommunityPost | undefined) {
  const openPost = useOpenPost();
  const sent = useRef<number | null>(null);
  useEffect(() => {
    if (!post || post.status !== 'VISIBLE' || sent.current === post.id) return;
    sent.current = post.id;
    openPost(post);
  }, [post, openPost]);
}

function PostView({ post, authKey }: { post: CommunityPost; authKey: string }) {
  const { status, me } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const toggleLike = useToggleLike();
  const toggleBookmark = useToggleBookmark();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const key = communityPostKey(post.id, authKey);
  const isAdmin = me?.role === 'ADMIN';
  const isMember = status === 'member';
  const deleted = post.status === 'DELETED';
  const hidden = post.status === 'HIDDEN';
  const info = post.community;
  const patch = (next: Partial<CommunityPost>) => client.setQueryData<CommunityPost>(key, (d) => (d ? { ...d, ...next } : d));

  useViewOnce(post);

  useEffect(() => {
    if (location.hash === '#comments') document.getElementById('comments')?.scrollIntoView?.({ block: 'start' });
  }, [location.hash]);

  const accept = useMutation({
    mutationFn: (c: Comment) => (post.acceptedCommentId === c.id ? unacceptComment(post.id) : acceptComment(post.id, c.id)),
    onSuccess: (res) => {
      patch({ acceptedCommentId: res.acceptedCommentId, community: { ...info, solved: res.solved } });
      client.invalidateQueries({ queryKey: [...POSTS_KEY, 'community'] });
      toast(res.acceptedCommentId ? '답을 채택했어요' : '채택을 취소했어요');
    },
    onError: (error) => toast(acceptError(error), 'error'),
  });

  const remove = useMutation({
    mutationFn: () => deleteCommunityPost(post.id),
    onSuccess: () => {
      toast('글을 삭제했어요');
      client.removeQueries({ queryKey: key });
      client.invalidateQueries({ queryKey: POSTS_KEY });
      refreshProfile(client);
      navigate(PATHS.community, { replace: true });
    },
    onError: (error) => toast(errorMessage(error, '글을 삭제하지 못했어요'), 'error'),
  });

  const hide = useMutation({
    mutationFn: (next: boolean) => setCommunityPostHidden(post.id, next),
    onSuccess: (res) => {
      client.setQueryData(key, res);
      client.invalidateQueries({ queryKey: [...POSTS_KEY, 'community'] });
      toast(res.status === 'HIDDEN' ? '글을 숨겼어요' : '숨김을 풀었어요');
    },
    onError: (error) => toast(errorMessage(error, '숨김 상태를 바꾸지 못했어요'), 'error'),
  });

  const acceptControl: AcceptControl | undefined =
    info.category === 'QUESTION'
      ? {
          acceptedId: post.acceptedCommentId,
          canAccept: post.mine && post.status === 'VISIBLE',
          pending: accept.isPending,
          onToggle: (c) => accept.mutate(c),
        }
      : undefined;

  if (deleted) {
    return (
      <article className="mx-auto max-w-3xl">
        <BackLink />
        <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-line px-4 py-10 text-center text-sm text-fg-muted">
          삭제된 글이에요
        </div>
        <div className="mt-8">
          <h2 className="mb-2 text-base font-semibold">댓글 {formatNumber(post.commentCount ?? 0)}</h2>
          <CommentSection post={post} id="comments" closed flat />
        </div>
      </article>
    );
  }

  const likes = post.likeCount ?? 0;

  return (
    <article className="mx-auto max-w-3xl" aria-labelledby="community-post-title">
      <BackLink />
      {hidden && (
        <p role="status" className="mt-4 rounded-[var(--radius-md)] border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {isAdmin && !post.mine ? '숨겨진 글이에요. 작성자와 관리자만 볼 수 있어요' : '신고 검토 중이거나 관리자가 숨긴 글이에요'}
        </p>
      )}
      <header className="mt-4 border-b border-line pb-4">
        <div className="flex items-center gap-1.5">
          <CategoryBadge category={info.category} />
          {info.solved && <SolvedBadge />}
        </div>
        <h1 id="community-post-title" className="mt-2 break-words text-2xl font-bold leading-snug tracking-[-0.01em]">
          {post.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-fg-secondary">
          {info.author && (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar nickname={info.author.nickname} size={24} />
              <span className="truncate font-medium text-fg">{info.author.nickname}</span>
              <GradeBadge grade={info.author.grade} small />
            </span>
          )}
          <span aria-hidden>·</span>
          <time dateTime={post.publishedAt}>{relativeTime(post.publishedAt)}</time>
          {info.editedAt && <span className="text-fg-muted">· 수정됨</span>}
          <span className="text-fg-muted">· 조회 {formatNumber(info.viewCount)}</span>
          <span className="ml-auto flex items-center gap-3">
            {post.mine && !hidden && (
              <Link to={communityEditPath(post.id)} className={ACTION}>
                수정
              </Link>
            )}
            {(post.mine || isAdmin) && (
              <button type="button" className={ACTION} onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            )}
            {isAdmin && (
              <button type="button" className={ACTION} disabled={hide.isPending} onClick={() => hide.mutate(!hidden)}>
                {hidden ? '숨김 해제' : '숨김'}
              </button>
            )}
            {isMember && !post.mine && (
              <button type="button" className={ACTION} disabled={post.reportedByMe} onClick={() => setReporting(true)}>
                {post.reportedByMe ? '신고함' : '신고'}
              </button>
            )}
          </span>
        </div>
        {post.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-fg-muted" aria-label="태그">
            {post.tags.map((t) => (
              <li key={t.id}>#{t.name}</li>
            ))}
          </ul>
        )}
      </header>

      <div className="py-6">
        <LazyMarkdown source={post.body ?? ''} />
      </div>

      <div className="flex items-center justify-between border-y border-line py-2">
        <button
          type="button"
          onClick={() => toggleLike(post)}
          disabled={hidden && !post.likedByMe}
          aria-pressed={!!post.likedByMe}
          aria-label={`좋아요 ${formatNumber(likes)}개`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm tabular-nums hover:bg-subtle disabled:opacity-50',
            post.likedByMe ? 'text-hot' : 'text-fg-secondary',
          )}
        >
          <FiHeart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} aria-hidden />
          {compactNumber(likes)}
        </button>
        <button
          type="button"
          onClick={() => toggleBookmark(post)}
          disabled={hidden && !post.isBookmarked}
          aria-pressed={!!post.isBookmarked}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-subtle disabled:opacity-50',
            post.isBookmarked ? 'text-warn' : 'text-fg-secondary',
          )}
        >
          <FiStar size={16} fill={post.isBookmarked ? 'currentColor' : 'none'} aria-hidden />
          {post.isBookmarked ? '북마크됨' : '북마크'}
        </button>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-base font-semibold">댓글 {formatNumber(post.commentCount ?? 0)}</h2>
        <CommentSection post={post} id="comments" accept={acceptControl} closed={hidden} flat />
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="글 삭제"
        confirmLabel="삭제"
        danger
        pending={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove.mutate();
        }}
      >
        {(post.commentCount ?? 0) > 0
          ? '댓글이 있어서 "삭제된 글이에요"로 남고 댓글은 그대로 보여요. 삭제할까요?'
          : '글을 삭제할까요? 되돌릴 수 없어요.'}
      </ConfirmModal>
      <ReportModal
        target={reporting ? { type: 'POST', id: post.id } : null}
        onClose={() => setReporting(false)}
        onReported={() => patch({ reportedByMe: true })}
      />
    </article>
  );
}

export function CommunityPostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const { status } = useAuth();
  const valid = Number.isInteger(postId) && postId > 0;
  const query = useQuery({ ...communityPostQuery(postId, status), enabled: valid && status !== 'loading' });
  const notFound = !valid || (query.isError && query.error instanceof ApiError && query.error.status === 404);
  const post = query.data;
  useSeoOverride(
    notFound
      ? { title: `글을 찾을 수 없어요 · ${SITE_NAME}`, robots: ROBOTS_NOINDEX }
      : post && post.status === 'VISIBLE'
        ? { title: `${post.title} · ${SITE_NAME}`, description: plainExcerpt(post.summary || post.body) || undefined, ogType: 'article' }
        : post
          ? { title: `${post.title} · ${SITE_NAME}`, robots: ROBOTS_NOINDEX }
          : null,
  );

  if (notFound) {
    return (
      <EmptyState
        title="글을 찾을 수 없어요"
        description="삭제됐거나 볼 수 없는 글이에요"
        action={
          <Link to={PATHS.community} className="text-sm font-medium text-brand">
            자유 게시판으로
          </Link>
        }
      />
    );
  }
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  if (!query.data) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse" aria-busy="true" aria-label="글을 불러오는 중">
        <span className="block h-4 w-20 rounded bg-subtle" />
        <span className="mt-6 block h-7 w-3/4 rounded bg-subtle" />
        <span className="mt-4 block h-4 w-1/2 rounded bg-subtle" />
        <span className="mt-8 block h-40 rounded bg-subtle" />
      </div>
    );
  }
  return <PostView post={query.data} authKey={status} />;
}
