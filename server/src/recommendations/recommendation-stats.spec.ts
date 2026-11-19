import { impressionRetentionThreshold, statsRange } from './recommendation-stats';

describe('recommendation stats range', () => {
  it('UTC 오늘 0시 - 6일부터 현재까지 재집계, 90일 지난 원본 삭제', () => {
    const now = new Date('2026-11-19T19:00:00Z');
    expect(statsRange(now)).toEqual({ from: new Date('2026-11-13T00:00:00Z'), to: now });
    expect(impressionRetentionThreshold(now).toISOString()).toBe('2026-08-21T19:00:00.000Z');
  });
});
