import {
  PASSWORD_RULE,
  classifyRefreshToken,
  hashRefreshToken,
  lockRemainingSec,
  nextFailureState,
  readCookie,
  refreshCookie,
} from './auth-policy';

const now = new Date('2026-11-19T00:00:00Z');

describe('nextFailureState', () => {
  it('4회까지는 횟수만 늘림', () => {
    expect(nextFailureState(3, now)).toEqual({ failedCount: 4, lockedUntil: null });
  });

  it('5회째 실패하면 10분 잠그고 횟수를 초기화함', () => {
    expect(nextFailureState(4, now)).toEqual({ failedCount: 0, lockedUntil: new Date('2026-11-19T00:10:00Z') });
  });
});

describe('lockRemainingSec', () => {
  it('남은 초를 올림으로 계산하고 지났으면 0', () => {
    expect(lockRemainingSec(new Date('2026-11-19T00:00:01.200Z'), now)).toBe(2);
    expect(lockRemainingSec(new Date('2026-11-18T23:59:59Z'), now)).toBe(0);
    expect(lockRemainingSec(null, now)).toBe(0);
  });
});

describe('classifyRefreshToken', () => {
  const future = new Date('2026-12-01T00:00:00Z');
  it('유효·만료·없음', () => {
    expect(classifyRefreshToken({ expiresAt: future, revokedAt: null }, now)).toBe('valid');
    expect(classifyRefreshToken({ expiresAt: now, revokedAt: null }, now)).toBe('invalid');
    expect(classifyRefreshToken(null, now)).toBe('invalid');
  });

  it('폐기 직후(30초 이내) 재사용은 동시 요청으로 보고, 이후 재사용은 탈취 의심', () => {
    expect(classifyRefreshToken({ expiresAt: future, revokedAt: new Date('2026-11-18T23:59:50Z') }, now)).toBe('invalid');
    expect(classifyRefreshToken({ expiresAt: future, revokedAt: new Date('2026-11-18T23:50:00Z') }, now)).toBe('reused');
  });
});

describe('cookie', () => {
  it('쿠키 헤더에서 이름으로 값을 읽음', () => {
    expect(readCookie('a=1; df_rt=abc-_; b=2', 'df_rt')).toBe('abc-_');
    expect(readCookie('a=1', 'df_rt')).toBeNull();
    expect(readCookie(undefined, 'df_rt')).toBeNull();
    expect(readCookie('df_rt=%E0%A4%A', 'df_rt')).toBeNull();
  });

  it('리프레시 쿠키 속성을 명세대로 만듦', () => {
    expect(refreshCookie('tok', true, 1209600)).toBe(
      'df_rt=tok; Path=/api/auth; Max-Age=1209600; HttpOnly; SameSite=Strict; Secure',
    );
    expect(refreshCookie(null, false, 1209600)).toBe('df_rt=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict');
  });

  it('토큰 해시는 32바이트 고정', () => {
    expect(hashRefreshToken('x')).toHaveLength(32);
  });
});

describe('PASSWORD_RULE', () => {
  it('8~64자, 영문·숫자 포함, 공백 없는 출력 가능 ASCII', () => {
    expect(PASSWORD_RULE.test('abcd1234')).toBe(true);
    expect(PASSWORD_RULE.test('Ab1!@#xyz')).toBe(true);
    expect(PASSWORD_RULE.test('abcdefgh')).toBe(false);
    expect(PASSWORD_RULE.test('12345678')).toBe(false);
    expect(PASSWORD_RULE.test('abc123')).toBe(false);
    expect(PASSWORD_RULE.test('abcd 1234')).toBe(false);
    expect(PASSWORD_RULE.test('비밀번호abc123')).toBe(false);
    expect(PASSWORD_RULE.test(`a1${'x'.repeat(63)}`)).toBe(false);
  });
});
