import { popularSince, searchSince } from './period';

const now = new Date('2026-11-19T12:00:00Z');

describe('period', () => {
  it('인기 글 기간은 24시간·7일·30일 롤링', () => {
    expect(popularSince('DAY', now).toISOString()).toBe('2026-11-18T12:00:00.000Z');
    expect(popularSince('WEEK', now).toISOString()).toBe('2026-11-12T12:00:00.000Z');
    expect(popularSince('MONTH', now).toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('검색 기간 ALL은 제한 없음', () => {
    expect(searchSince('1Y', now)?.toISOString()).toBe('2025-11-19T12:00:00.000Z');
    expect(searchSince('ALL', now)).toBeNull();
  });
});
