import { request } from './http';
import type {
  AdminSource,
  AdminSourceListItem,
  AdminStats,
  AdminTag,
  CrawlRun,
  FeedValidationResult,
  Job,
  SourceInput,
  SourceStatus,
  TagInput,
  UpdateSourceInput,
} from './types';

export const fetchAdminStats = () => request<AdminStats>('/admin/stats');

export const fetchAdminSources = (status: SourceStatus | null) =>
  request<{ items: AdminSourceListItem[] }>('/admin/sources', { query: { status } });

export const fetchAdminSource = (id: number) => request<AdminSource>(`/admin/sources/${id}`);

export const fetchCrawlRuns = (id: number) =>
  request<{ items: CrawlRun[] }>(`/admin/sources/${id}/runs`, { query: { size: 50 } });

export const validateFeed = (feedUrl: string) =>
  request<FeedValidationResult>('/admin/sources/validate', { method: 'POST', json: { feedUrl } });

export const createSource = (input: SourceInput) =>
  request<AdminSource>('/admin/sources', { method: 'POST', json: input });

export const updateSource = (id: number, input: UpdateSourceInput) =>
  request<AdminSource>(`/admin/sources/${id}`, { method: 'PATCH', json: input });

export const crawlSource = (id: number) =>
  request<{ crawlRunId: number }>(`/admin/sources/${id}/crawl`, { method: 'POST' });

export const resumeSource = (id: number) => request<AdminSource>(`/admin/sources/${id}/resume`, { method: 'POST' });

export const fetchAdminTags = (q: string) => request<{ items: AdminTag[] }>('/admin/tags', { query: { q } });

export const createTag = (input: TagInput) => request<AdminTag>('/admin/tags', { method: 'POST', json: input });

export const updateTag = (id: number, input: Partial<TagInput>) =>
  request<AdminTag>(`/admin/tags/${id}`, { method: 'PATCH', json: input });

export const startRetag = () => request<{ jobId: string }>('/admin/tags/retag', { method: 'POST' });

export const fetchJob = (jobId: string) => request<Job>(`/admin/jobs/${jobId}`);
