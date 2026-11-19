import { request } from './http';
import type { AuthResponse, BookmarkPage, CursorPage, HistoryItem, Me, SignupInput, TagRef } from './types';

export const ME_PAGE_SIZE = 20;
export const INTEREST_MIN = 3;
export const INTEREST_MAX = 10;

export const signup = (input: SignupInput) => request<AuthResponse>('/auth/signup', { method: 'POST', json: input });

export const updateNickname = (nickname: string) => request<Me>('/me', { method: 'PATCH', json: { nickname } });

export const withdraw = (password: string) => request<void>('/me/withdraw', { method: 'POST', json: { password } });

export const completeOnboarding = () => request<void>('/me/onboarding/complete', { method: 'POST' });

export const fetchInterestTags = () => request<{ items: TagRef[] }>('/me/interest-tags');

export const saveInterestTags = (tagIds: number[]) =>
  request<{ items: TagRef[] }>('/me/interest-tags', { method: 'PUT', json: { tagIds } });

export const fetchBookmarks = (tagId: number | null, cursor?: string, signal?: AbortSignal) =>
  request<BookmarkPage>('/me/bookmarks', { signal, query: { cursor, size: ME_PAGE_SIZE, tagIds: tagId ? [tagId] : [] } });

export const fetchHistory = (cursor?: string, signal?: AbortSignal) =>
  request<CursorPage<HistoryItem>>('/me/history', { signal, query: { cursor, size: ME_PAGE_SIZE } });

export const deleteHistoryItem = (postId: number) => request<void>(`/me/history/${postId}`, { method: 'DELETE' });

export const clearHistory = () => request<void>('/me/history', { method: 'DELETE' });
