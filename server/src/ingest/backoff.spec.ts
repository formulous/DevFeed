import { MAX_INTERVAL_MIN, nextIntervalMinutes, retryDelayMs } from './backoff';

describe('nextIntervalMinutes', () => {
  it('연속 실패 5회 미만이면 기본 주기', () => {
    expect(nextIntervalMinutes(60, 0)).toBe(60);
    expect(nextIntervalMinutes(60, 4)).toBe(60);
  });

  it('5회부터 min(주기 × 2^(실패-4), 24시간)', () => {
    expect(nextIntervalMinutes(60, 5)).toBe(120);
    expect(nextIntervalMinutes(60, 6)).toBe(240);
    expect(nextIntervalMinutes(60, 10)).toBe(MAX_INTERVAL_MIN);
    expect(nextIntervalMinutes(60, 1000)).toBe(MAX_INTERVAL_MIN);
  });
});

describe('retryDelayMs', () => {
  it('지수 백오프', () => {
    expect([1, 2, 3].map((n) => retryDelayMs(n))).toEqual([1000, 2000, 4000]);
  });
});
