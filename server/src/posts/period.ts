export type PopularPeriod = 'DAY' | 'WEEK' | 'MONTH';
export type SearchPeriod = '1W' | '1M' | '1Y' | 'ALL';

const DAY_MS = 24 * 60 * 60 * 1000;
const POPULAR_DAYS: Record<PopularPeriod, number> = { DAY: 1, WEEK: 7, MONTH: 30 };
const SEARCH_DAYS: Record<SearchPeriod, number | null> = { '1W': 7, '1M': 30, '1Y': 365, ALL: null };

export function popularSince(period: PopularPeriod, now: Date): Date {
  return new Date(now.getTime() - POPULAR_DAYS[period] * DAY_MS);
}

export function searchSince(period: SearchPeriod, now: Date): Date | null {
  const days = SEARCH_DAYS[period];
  return days === null ? null : new Date(now.getTime() - days * DAY_MS);
}
