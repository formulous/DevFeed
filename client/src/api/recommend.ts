import { request } from './http';
import type { RecommendationPage } from './types';

export const RECOMMEND_PAGE_SIZE = 20;

export const fetchRecommendations = (cursor?: string, signal?: AbortSignal) =>
  request<RecommendationPage>('/recommendations', { signal, query: { cursor, size: RECOMMEND_PAGE_SIZE } });
