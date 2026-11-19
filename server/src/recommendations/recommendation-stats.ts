const DAY_MS = 24 * 60 * 60 * 1000;
export const STATS_RECOMPUTE_DAYS = 7;
export const IMPRESSION_RETENTION_DAYS = 90;

export function startOfUtcDay(now: Date): Date {
  return new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
}

export function statsRange(now: Date): { from: Date; to: Date } {
  return { from: new Date(startOfUtcDay(now).getTime() - (STATS_RECOMPUTE_DAYS - 1) * DAY_MS), to: now };
}

export function impressionRetentionThreshold(now: Date): Date {
  return new Date(now.getTime() - IMPRESSION_RETENTION_DAYS * DAY_MS);
}
