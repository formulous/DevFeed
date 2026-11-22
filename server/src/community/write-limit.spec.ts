import { postWriteStatus } from './write-limit';

const now = new Date('2026-11-22T05:00:00.000Z');
const old = new Date('2026-01-01T00:00:00.000Z');
const base = { isAdmin: false, newAccountLimit: true, accountCreatedAt: old, todayCount: 0, lastWrittenAt: null, now };

describe('postWriteStatus', () => {
  it('제한 없으면 허용, 오늘 남은 수', () => {
    expect(postWriteStatus({ ...base, todayCount: 2 })).toEqual({
      allowed: true,
      reason: null,
      availableAt: null,
      retryAfterSec: null,
      remainingToday: 3,
    });
  });

  it('가입 24시간 미만', () => {
    const created = new Date(now.getTime() - 23 * 3600_000);
    const s = postWriteStatus({ ...base, accountCreatedAt: created });
    expect(s).toMatchObject({ allowed: false, reason: 'NEW_ACCOUNT', retryAfterSec: 3600 });
    expect(s.availableAt?.toISOString()).toBe('2026-11-22T06:00:00.000Z');
  });

  it('가입 제한을 끄면 새 계정도 허용, 다른 제한은 유지', () => {
    const created = new Date(now.getTime() - 60_000);
    expect(postWriteStatus({ ...base, newAccountLimit: false, accountCreatedAt: created })).toMatchObject({ allowed: true, remainingToday: 5 });
    expect(postWriteStatus({ ...base, newAccountLimit: false, accountCreatedAt: created, todayCount: 5 }).reason).toBe('DAILY_LIMIT');
  });

  it('하루 5개면 다음 KST 자정까지', () => {
    const s = postWriteStatus({ ...base, todayCount: 5 });
    expect(s).toMatchObject({ allowed: false, reason: 'DAILY_LIMIT', remainingToday: 0 });
    expect(s.availableAt?.toISOString()).toBe('2026-11-22T15:00:00.000Z');
  });

  it('마지막 글 60초 안', () => {
    const s = postWriteStatus({ ...base, lastWrittenAt: new Date(now.getTime() - 20_000) });
    expect(s).toMatchObject({ allowed: false, reason: 'COOLDOWN', retryAfterSec: 40 });
  });

  it('60초 지나면 허용', () => {
    expect(postWriteStatus({ ...base, lastWrittenAt: new Date(now.getTime() - 60_000) }).allowed).toBe(true);
  });

  it('여러 사유면 가장 늦게 풀리는 것', () => {
    const s = postWriteStatus({ ...base, todayCount: 5, lastWrittenAt: new Date(now.getTime() - 10_000) });
    expect(s.reason).toBe('DAILY_LIMIT');
  });

  it('관리자는 항상 허용, 남은 수 null', () => {
    expect(postWriteStatus({ ...base, isAdmin: true, todayCount: 9, accountCreatedAt: now })).toEqual({
      allowed: true,
      reason: null,
      availableAt: null,
      retryAfterSec: null,
      remainingToday: null,
    });
  });
});
