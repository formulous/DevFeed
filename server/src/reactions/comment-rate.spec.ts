import { commentRetryAfterSec } from './comment-rate';

const now = new Date('2026-11-21T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('commentRetryAfterSec', () => {
  it('1분에 4개까지는 통과, 5개면 가장 오래된 것이 1분 지날 때까지 대기', () => {
    expect(commentRetryAfterSec([1, 2, 3, 4].map((s) => ago(s * 1000)), now)).toBeNull();
    expect(commentRetryAfterSec([1, 2, 3, 4, 10].map((s) => ago(s * 1000)), now)).toBe(50);
  });

  it('1분 지난 기록은 분당 제한에서 빠짐', () => {
    expect(commentRetryAfterSec([1, 2, 3, 4, 61].map((s) => ago(s * 1000)), now)).toBeNull();
  });

  it('24시간 200개면 200번째가 하루 지날 때까지 대기', () => {
    const times = Array.from({ length: 200 }, (_, i) => ago(3_600_000 + i * 60_000));
    expect(commentRetryAfterSec(times, now)).toBe(Math.ceil((86_400_000 - 3_600_000 - 199 * 60_000) / 1000));
    expect(commentRetryAfterSec(times.slice(0, 199), now)).toBeNull();
  });
});
