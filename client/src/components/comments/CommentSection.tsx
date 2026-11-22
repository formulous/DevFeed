import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '@/api/http';
import { createComment, deleteComment, fetchComments, fetchReplies, setCommentHidden, updateComment } from '@/api/reactions';
import type { Comment, PostSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useToast } from '@/components/common/Toast';
import { patchPost } from '@/hooks/usePostActions';
import { refreshProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/profile/Avatar';
import { GradeBadge } from '@/components/profile/GradeBadge';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/time';
import { ReportModal, type ReportTargetRef } from '@/components/report/ReportModal';
import { addComment, appendReplies, commentsKey, markDeleted, markReported, removeComment, replaceComment } from './commentCache';
import { CommentForm } from './CommentForm';

function failMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === 'COMMENT_RATE_LIMITED') return '잠시 후 다시 남겨 주세요';
    if (error.code === 'NOT_FOUND') return '이미 삭제된 글이나 댓글이에요';
    if (error.code === 'COMMENT_HIDDEN') return '관리자가 숨긴 댓글은 고칠 수 없어요';
    if (error.code === 'COMMENT_ACCEPTED') return '채택된 댓글은 삭제할 수 없어요';
    if (error.code === 'COMMUNITY_POST_CLOSED') return '숨겨졌거나 삭제된 글에는 댓글을 남길 수 없어요';
    return error.message || fallback;
  }
  return fallback;
}

function useCommentActions(post: PostSummary) {
  const client = useQueryClient();
  const toast = useToast();
  const postId = post.id;
  const setCount = (commentCount: number) => {
    patchPost(client, postId, { commentCount });
    refreshProfile(client);
  };

  const run = async (fn: () => Promise<void>, fallback: string) => {
    try {
      await fn();
      return true;
    } catch (error) {
      toast(failMessage(error, fallback), 'error');
      return false;
    }
  };

  return {
    create: (content: string, parentId?: number) =>
      run(async () => {
        const res = await createComment(postId, content, parentId);
        addComment(client, postId, res.comment);
        setCount(res.commentCount);
      }, '댓글을 남기지 못했어요'),
    update: (id: number, content: string) =>
      run(async () => replaceComment(client, postId, await updateComment(id, content)), '댓글을 고치지 못했어요'),
    remove: (id: number) =>
      run(async () => {
        const res = await deleteComment(id);
        if (res.removed) removeComment(client, postId, id, res.parentRemoved);
        else markDeleted(client, postId, id);
        setCount(res.commentCount);
      }, '댓글을 삭제하지 못했어요'),
    hide: (comment: Comment, hidden: boolean) =>
      run(async () => {
        const res = await setCommentHidden(comment.id, hidden);
        replaceComment(client, postId, res.comment);
        setCount(res.commentCount);
      }, '숨김 상태를 바꾸지 못했어요'),
    moreReplies: (parent: Comment) =>
      run(async () => {
        const page = await fetchReplies(parent.id, parent.repliesNextCursor ?? undefined);
        appendReplies(client, postId, parent.id, page);
      }, '답글을 불러오지 못했어요'),
  };
}

type Actions = ReturnType<typeof useCommentActions>;

export interface AcceptControl {
  acceptedId: number | null;
  canAccept: boolean;
  pending: boolean;
  onToggle: (comment: Comment) => void;
}

interface ItemProps {
  comment: Comment;
  actions: Actions;
  isAdmin: boolean;
  isMember: boolean;
  accept?: AcceptControl;
  onReply?: () => void;
  onDelete: (c: Comment) => void;
  onReport: (c: Comment) => void;
}

function CommentItem({ comment, actions, isAdmin, isMember, accept, onReply, onDelete, onReport }: ItemProps) {
  const [editing, setEditing] = useState(false);
  const visible = comment.status === 'VISIBLE';
  const accepted = accept?.acceptedId === comment.id;
  const acceptable = !!accept?.canAccept && visible && comment.parentId === null && !comment.mine;
  const showMeta = visible || (isAdmin && comment.status === 'HIDDEN');
  const action = 'text-xs text-fg-muted hover:text-fg';

  return (
    <div className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-fg-secondary">
        {showMeta && comment.author && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar nickname={comment.author.nickname} size={20} />
            <span className="truncate font-medium text-fg">{comment.author.nickname}</span>
            {comment.author.grade && <GradeBadge grade={comment.author.grade} small />}
          </span>
        )}
        {showMeta && <span aria-hidden>·</span>}
        {showMeta && <time dateTime={comment.createdAt}>{relativeTime(comment.createdAt)}</time>}
        {showMeta && comment.editedAt && <span className="text-fg-muted">(수정됨)</span>}
        {accepted && (
          <span className="inline-flex items-center rounded-full bg-success-soft px-1.5 py-px text-[11px] font-semibold leading-4 text-success">
            채택
          </span>
        )}
        <span className="ml-auto flex gap-2.5">
          {acceptable && (
            <button
              type="button"
              className={cn(action, accepted && 'text-success')}
              disabled={accept?.pending}
              aria-pressed={accepted}
              onClick={() => accept?.onToggle(comment)}
            >
              {accepted ? '채택 취소' : '채택'}
            </button>
          )}
          {comment.mine && !editing && comment.status !== 'DELETED' && (
            <>
              {visible && (
                <button type="button" className={action} onClick={() => setEditing(true)}>
                  수정
                </button>
              )}
              {!accepted && (
                <button type="button" className={action} onClick={() => onDelete(comment)}>
                  삭제
                </button>
              )}
            </>
          )}
          {isMember && visible && !comment.mine && (
            <button
              type="button"
              className={action}
              disabled={comment.reportedByMe}
              onClick={() => onReport(comment)}
            >
              {comment.reportedByMe ? '신고함' : '신고'}
            </button>
          )}
          {isAdmin && comment.status !== 'DELETED' && (
            <button type="button" className={action} onClick={() => actions.hide(comment, visible)}>
              {visible ? '숨김' : '숨김 해제'}
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-1.5">
          <CommentForm
            initial={comment.content ?? ''}
            label="댓글 수정"
            placeholder="댓글을 고쳐 주세요"
            submitLabel="저장"
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={async (content) => {
              const ok = await actions.update(comment.id, content);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        </div>
      ) : visible ? (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{comment.content}</p>
      ) : (
        <p className="mt-0.5 text-sm text-fg-muted">
          {comment.status === 'HIDDEN' ? '숨겨진 댓글이에요' : '삭제된 댓글이에요'}
          {isAdmin && comment.status === 'HIDDEN' && comment.content && (
            <span className="mt-1 block whitespace-pre-wrap break-words text-xs line-through">{comment.content}</span>
          )}
        </p>
      )}
      {onReply && isMember && !editing && (
        <button type="button" className={cn(action, 'mt-1')} onClick={onReply}>
          답글 달기
        </button>
      )}
    </div>
  );
}

function Thread({ comment, ...rest }: Omit<ItemProps, 'onReply'> & { comment: Comment }) {
  const [replying, setReplying] = useState(false);
  const replies = comment.replies ?? [];
  const remaining = Math.max(0, comment.replyCount - replies.length);
  const openReply = () => setReplying(true);

  return (
    <li>
      <CommentItem comment={comment} {...rest} onReply={comment.status === 'VISIBLE' ? openReply : undefined} />
      {(replies.length > 0 || replying) && (
        <ul className="ml-3 border-l border-line pl-3" aria-label="답글">
          {replies.map((r) => (
            <li key={r.id}>
              <CommentItem comment={r} {...rest} onReply={comment.status === 'VISIBLE' && r.status === 'VISIBLE' ? openReply : undefined} />
            </li>
          ))}
          {comment.repliesNextCursor && (
            <li>
              <button type="button" className="py-1 text-xs font-medium text-brand" onClick={() => rest.actions.moreReplies(comment)}>
                답글 {remaining > 0 ? `${remaining}개 ` : ''}더보기
              </button>
            </li>
          )}
          {replying && (
            <li className="py-2">
              <CommentForm
                label="답글 입력"
                placeholder="답글을 남겨 주세요 (최대 1,000자)"
                submitLabel="등록"
                autoFocus
                onCancel={() => setReplying(false)}
                onSubmit={async (content) => {
                  const ok = await rest.actions.create(content, comment.id);
                  if (ok) setReplying(false);
                  return ok;
                }}
              />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

interface CommentSectionProps {
  post: PostSummary;
  id: string;
  accept?: AcceptControl;
  closed?: boolean;
  flat?: boolean;
}

export function CommentSection({ post, id, accept, closed = false, flat = false }: CommentSectionProps) {
  const { status, me } = useAuth();
  const location = useLocation();
  const client = useQueryClient();
  const actions = useCommentActions(post);
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [reporting, setReporting] = useState<ReportTargetRef | null>(null);
  const list = useInfiniteQuery({
    queryKey: commentsKey(post.id),
    queryFn: ({ pageParam, signal }) => fetchComments(post.id, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
  });
  const comments = useMemo(() => {
    const seen = new Set<number>();
    const all = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => !seen.has(c.id) && seen.add(c.id));
    const acceptedId = accept?.acceptedId ?? null;
    const top = all.find((c) => c.id === acceptedId);
    return top ? [top, ...all.filter((c) => c !== top)] : all;
  }, [list.data, accept?.acceptedId]);
  const isMember = status === 'member';
  const redirect = encodeURIComponent(location.pathname + location.search);
  const common = {
    actions,
    isAdmin: me?.role === 'ADMIN',
    isMember,
    accept,
    onDelete: setDeleting,
    onReport: (c: Comment) => setReporting({ type: 'COMMENT', id: c.id }),
  };

  return (
    <section
      id={id}
      aria-label="댓글"
      className={flat ? 'scroll-mt-28' : 'mx-3 mb-4 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-2 sm:mx-4'}
    >
      {list.isPending ? (
        <p className="py-3 text-sm text-fg-muted">댓글을 불러오는 중이에요</p>
      ) : list.isError ? (
        <p className="flex items-center gap-2 py-3 text-sm text-fg-secondary">
          댓글을 불러오지 못했어요
          <button type="button" className="font-medium text-brand" onClick={() => list.refetch()}>
            다시 시도
          </button>
        </p>
      ) : comments.length === 0 ? (
        <p className="py-3 text-sm text-fg-muted">아직 댓글이 없어요{isMember ? '. 첫 댓글을 남겨 보세요' : ''}</p>
      ) : (
        <ul className="divide-y divide-line">
          {comments.map((c) => (
            <Thread key={c.id} comment={c} {...common} />
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <button
          type="button"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
          className="mb-2 w-full rounded-full border border-line py-1.5 text-sm text-fg-secondary hover:bg-subtle disabled:opacity-50"
        >
          댓글 더보기
        </button>
      )}
      <div className="border-t border-line py-3">
        {closed ? (
          <p className="text-sm text-fg-muted">이 글에는 댓글을 남길 수 없어요</p>
        ) : isMember ? (
          <CommentForm
            label="댓글 입력"
            placeholder="댓글을 남겨 주세요 (최대 1,000자)"
            submitLabel="등록"
            onSubmit={(content) => actions.create(content)}
          />
        ) : status === 'guest' ? (
          <p className="text-sm text-fg-secondary">
            <Link to={`/login?redirect=${redirect}`} className="font-medium text-brand">
              로그인
            </Link>
            하고 댓글을 남겨 보세요
          </p>
        ) : null}
      </div>
      <ReportModal
        target={reporting}
        onClose={() => setReporting(null)}
        onReported={(t) => markReported(client, post.id, t.id)}
      />
      <ConfirmModal
        open={deleting !== null}
        title="댓글 삭제"
        confirmLabel="삭제"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const target = deleting;
          setDeleting(null);
          if (target) await actions.remove(target.id);
        }}
      >
        {deleting && deleting.replyCount > 0 ? '답글이 있어서 "삭제된 댓글이에요"로 남아요. 삭제할까요?' : '댓글을 삭제할까요? 되돌릴 수 없어요.'}
      </ConfirmModal>
    </section>
  );
}
