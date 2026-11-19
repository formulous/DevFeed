import { queryOptions } from '@tanstack/react-query';
import { fetchAdminSource, fetchAdminSources, fetchAdminStats, fetchAdminTags, fetchCrawlRuns } from '@/api/admin';
import type { SourceStatus } from '@/api/types';

export const ADMIN_KEY = ['admin'] as const;
export const RUN_POLL_MS = 3000;
export const JOB_POLL_MS = 1500;

export const adminStatsQuery = queryOptions({
  queryKey: [...ADMIN_KEY, 'stats'],
  queryFn: fetchAdminStats,
});

export const adminSourcesQuery = (status: SourceStatus | null) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, 'sources', status],
    queryFn: () => fetchAdminSources(status),
    select: (data) => data.items,
  });

export const adminSourceQuery = (id: number) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, 'source', id],
    queryFn: () => fetchAdminSource(id),
  });

export const crawlRunsQuery = (id: number) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, 'runs', id],
    queryFn: () => fetchCrawlRuns(id),
    select: (data) => data.items,
    refetchInterval: (query) => (query.state.data?.items.some((r) => r.result === 'RUNNING') ? RUN_POLL_MS : false),
  });

export const adminTagsQuery = (q: string) =>
  queryOptions({
    queryKey: [...ADMIN_KEY, 'tags', q],
    queryFn: () => fetchAdminTags(q),
    select: (data) => data.items,
    placeholderData: (prev) => prev,
  });
