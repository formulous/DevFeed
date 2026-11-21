import { request } from './http';
import type { Comment, CommentCreated, CommentWithCount, CommentRemoved, CursorPage, LikeResult } from './types';

export const COMMENT_PAGE_SIZE = 20;
export const COMMENT_MAX = 1000;

export function putLike(postId: number) {
  return request<LikeResult>(`/posts/${postId}/like`, { method: 'PUT' });
}

export function deleteLike(postId: number) {
  return request<LikeResult>(`/posts/${postId}/like`, { method: 'DELETE' });
}

export function fetchComments(postId: number, cursor?: string, signal?: AbortSignal) {
  return request<CursorPage<Comment>>(`/posts/${postId}/comments`, { signal, query: { cursor, size: COMMENT_PAGE_SIZE } });
}

export function fetchReplies(commentId: number, cursor?: string) {
  return request<CursorPage<Comment>>(`/comments/${commentId}/replies`, { query: { cursor, size: COMMENT_PAGE_SIZE } });
}

export function createComment(postId: number, content: string, parentId?: number) {
  return request<CommentCreated>(`/posts/${postId}/comments`, { method: 'POST', json: { content, parentId } });
}

export function updateComment(commentId: number, content: string) {
  return request<Comment>(`/comments/${commentId}`, { method: 'PATCH', json: { content } });
}

export function deleteComment(commentId: number) {
  return request<CommentRemoved>(`/comments/${commentId}`, { method: 'DELETE' });
}

export function setCommentHidden(commentId: number, hidden: boolean) {
  return request<CommentWithCount>(`/admin/comments/${commentId}/hidden`, { method: hidden ? 'PUT' : 'DELETE' });
}
