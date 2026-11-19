export const ERROR_THRESHOLD = 5;
export const MAX_INTERVAL_MIN = 24 * 60;

export function nextIntervalMinutes(intervalMin: number, consecutiveFailures: number): number {
  if (consecutiveFailures < ERROR_THRESHOLD) return intervalMin;
  const multiplier = 2 ** Math.min(consecutiveFailures - (ERROR_THRESHOLD - 1), 16);
  return Math.min(intervalMin * multiplier, MAX_INTERVAL_MIN);
}

export function retryDelayMs(attempt: number, baseMs = 1000): number {
  return baseMs * 2 ** (attempt - 1);
}
