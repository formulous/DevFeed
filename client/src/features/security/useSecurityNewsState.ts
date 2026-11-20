import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { SecurityNewsQuery } from '@/api/securityNews';
import type { NewsRegion } from '@/api/types';

const REGION_PARAM: Record<string, NewsRegion> = { domestic: 'DOMESTIC', overseas: 'OVERSEAS' };
export const MAX_NEWS_SOURCES = 20;

export function parseSecurityNews(params: URLSearchParams): SecurityNewsQuery {
  const ids = (params.get('sourceIds') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return {
    region: REGION_PARAM[params.get('region') ?? ''] ?? null,
    sourceIds: Array.from(new Set(ids)).slice(0, MAX_NEWS_SOURCES),
  };
}

export function regionParam(region: NewsRegion | null) {
  return Object.entries(REGION_PARAM).find(([, v]) => v === region)?.[0] ?? null;
}

export function useSecurityNewsState() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseSecurityNews(params), [params]);

  const write = useCallback(
    (next: SecurityNewsQuery) => {
      const out = new URLSearchParams();
      const r = regionParam(next.region);
      if (r) out.set('region', r);
      if (next.sourceIds.length) out.set('sourceIds', next.sourceIds.join(','));
      setParams(out, { replace: true });
    },
    [setParams],
  );

  return {
    query,
    setRegion: (region: NewsRegion | null) => write({ ...query, region }),
    setSources: (sourceIds: number[]) => write({ ...query, sourceIds }),
    toggleSource: (id: number) =>
      write({
        ...query,
        sourceIds: query.sourceIds.includes(id) ? query.sourceIds.filter((v) => v !== id) : [...query.sourceIds, id],
      }),
    reset: () => write({ region: null, sourceIds: [] }),
    activeCount: query.sourceIds.length + (query.region ? 1 : 0),
  };
}
