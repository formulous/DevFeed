const RETRYABLE_ERRNOS = new Set([1213, 1205, 1020]);

export function isRetryableLockError(error: unknown): boolean {
  const e = error as { errno?: number; driverError?: { errno?: number } };
  const errno = e?.driverError?.errno ?? e?.errno;
  return errno !== undefined && RETRYABLE_ERRNOS.has(errno);
}

export async function withDeadlockRetry<T>(
  work: () => Promise<T>,
  maxRetries = 3,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableLockError(error)) throw error;
      await sleep(20 * 2 ** attempt + Math.floor(Math.random() * 20));
    }
  }
}
