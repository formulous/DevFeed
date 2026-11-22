import { request } from './http';
import type {
  AcceptedCommentState,
  CommunityCategory,
  CommunityPost,
  CommunityPostInput,
  CursorPage,
  PopularPeriod,
  PopularPost,
  PostSummary,
  PostWriteStatus,
  ReportInput,
  ReportState,
  ReportTarget,
  ReportTargetType,
} from './types';

export const COMMUNITY_PAGE_SIZE = 20;
export const TITLE_MIN = 2;
export const TITLE_MAX = 100;
export const BODY_MIN = 10;
export const BODY_MAX = 20_000;
export const TAG_MAX = 5;
export const REPORT_DETAIL_MAX = 200;

export function fetchCommunityPosts(category: CommunityCategory | null, cursor?: string, signal?: AbortSignal) {
  return request<CursorPage<PostSummary>>('/community/posts', {
    signal,
    query: { cursor, size: COMMUNITY_PAGE_SIZE, category },
  });
}

export function fetchCommunityPopular(period: PopularPeriod, category: CommunityCategory | null, signal?: AbortSignal) {
  return request<{ items: PopularPost[] }>('/community/popular', { signal, query: { period, category } });
}

export const fetchWriteStatus = (signal?: AbortSignal) =>
  request<PostWriteStatus>('/community/write-status', { signal, cache: 'no-store' });

export const fetchCommunityPost = (id: number, signal?: AbortSignal) =>
  request<CommunityPost>(`/community/posts/${id}`, { signal });

export const createCommunityPost = (input: CommunityPostInput) =>
  request<CommunityPost>('/community/posts', { method: 'POST', json: input });

export const updateCommunityPost = (id: number, input: Partial<CommunityPostInput>) =>
  request<CommunityPost>(`/community/posts/${id}`, { method: 'PATCH', json: input });

export const deleteCommunityPost = (id: number) => request<void>(`/community/posts/${id}`, { method: 'DELETE' });

export const acceptComment = (postId: number, commentId: number) =>
  request<AcceptedCommentState>(`/community/posts/${postId}/accepted-comment`, { method: 'PUT', json: { commentId } });

export const unacceptComment = (postId: number) =>
  request<AcceptedCommentState>(`/community/posts/${postId}/accepted-comment`, { method: 'DELETE' });

export const createReport = (input: ReportInput) => request<void>('/reports', { method: 'POST', json: input });

export const fetchReports = (state: Exclude<ReportState, 'CLEARED'> | null, cursor?: string, signal?: AbortSignal) =>
  request<CursorPage<ReportTarget>>('/admin/reports', { signal, query: { state, cursor, size: COMMUNITY_PAGE_SIZE } });

export const resolveReport = (targetType: ReportTargetType, targetId: number, action: 'HIDE' | 'CLEAR') =>
  request<ReportTarget>(`/admin/reports/${targetType}/${targetId}`, { method: 'PUT', json: { action } });

export const setCommunityPostHidden = (id: number, hidden: boolean) =>
  request<CommunityPost>(`/admin/community/posts/${id}/hidden`, { method: hidden ? 'PUT' : 'DELETE' });
