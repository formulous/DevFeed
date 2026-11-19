import { startOfKstDay } from './time';

describe('startOfKstDay', () => {
  it('Asia/Seoul 자정을 UTC로 반환함', () => {
    expect(startOfKstDay(new Date('2026-11-19T10:00:00Z')).toISOString()).toBe('2026-11-18T15:00:00.000Z');
    expect(startOfKstDay(new Date('2026-11-19T15:30:00Z')).toISOString()).toBe('2026-11-19T15:00:00.000Z');
  });
});
