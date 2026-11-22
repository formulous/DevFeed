import { request } from './http';
import type { ApiField } from '@/lib/fields';
import type { CursorPage, PopularPeriod, PopularPost, PostSummary, SourceListItem, SourceType, TagItem } from './types';

export interface FeedQuery {
  tagIds: number[];
  sourceIds: number[];
  sourceType: SourceType | null;
  field: ApiField | null;
}

export const FEED_PAGE_SIZE = 20;
export const MAX_TAG_FILTER = 10;
export const MAX_SOURCE_FILTER = 20;

export function fetchFeed(filters: FeedQuery, cursor?: string, signal?: AbortSignal) {
  return request<CursorPage<PostSummary>>('/posts', {
    signal,
    query: {
      cursor,
      size: FEED_PAGE_SIZE,
      tagIds: filters.tagIds,
      sourceIds: filters.sourceIds,
      sourceType: filters.sourceType,
      field: filters.field,
    },
  });
}

export function fetchPopular(period: PopularPeriod, field: ApiField | null, signal?: AbortSignal) {
  return request<{ items: PopularPost[] }>('/posts/popular', { signal, query: { period, field } });
}

export function fetchTags(signal?: AbortSignal) {
  return request<{ items: TagItem[] }>('/tags', { signal, query: { sort: 'POST_COUNT' } });
}

export function fetchSources(signal?: AbortSignal) {
  return request<{ items: SourceListItem[] }>('/sources', { signal });
}

export function putBookmark(postId: number) {
  return request<void>(`/me/bookmarks/${postId}`, { method: 'PUT' });
}

export function deleteBookmark(postId: number) {
  return request<void>(`/me/bookmarks/${postId}`, { method: 'DELETE' });
}

export function recordView(postId: number, recommendationId?: string) {
  return request<void>(`/posts/${postId}/views`, {
    method: 'POST',
    keepalive: true,
    json: recommendationId ? { recommendationId } : undefined,
  }).catch(() => undefined);
}
