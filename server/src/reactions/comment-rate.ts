export const COMMENT_RATE = { perMinute: 5, perDay: 200 } as const;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export function commentRetryAfterSec(recentDesc: Date[], now: Date): number | null {
  const t = now.getTime();
  const waits: number[] = [];
  const inMinute = recentDesc.filter((at) => t - at.getTime() < MINUTE_MS);
  if (inMinute.length >= COMMENT_RATE.perMinute) {
    waits.push(inMinute[COMMENT_RATE.perMinute - 1].getTime() + MINUTE_MS - t);
  }
  const inDay = recentDesc.filter((at) => t - at.getTime() < DAY_MS);
  if (inDay.length >= COMMENT_RATE.perDay) {
    waits.push(inDay[COMMENT_RATE.perDay - 1].getTime() + DAY_MS - t);
  }
  if (!waits.length) return null;
  return Math.max(1, Math.ceil(Math.max(...waits) / 1000));
}
