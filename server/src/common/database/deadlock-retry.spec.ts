import { isRetryableLockError, withDeadlockRetry } from './deadlock-retry';

const deadlock = Object.assign(new Error('Deadlock found'), { driverError: { errno: 1213 } });
const noSleep = async () => undefined;

describe('withDeadlockRetry', () => {
  it('데드락이면 다시 실행해 성공 결과를 반환함', async () => {
    let calls = 0;
    const result = await withDeadlockRetry(async () => {
      if (++calls < 3) throw deadlock;
      return 'ok';
    }, 3, noSleep);
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('재시도 한도를 넘으면 마지막 오류를 던짐', async () => {
    let calls = 0;
    await expect(withDeadlockRetry(async () => {
      calls++;
      throw deadlock;
    }, 2, noSleep)).rejects.toBe(deadlock);
    expect(calls).toBe(3);
  });

  it('잠금 오류가 아니면 바로 던짐', async () => {
    let calls = 0;
    const other = Object.assign(new Error('dup'), { errno: 1062 });
    await expect(withDeadlockRetry(async () => {
      calls++;
      throw other;
    }, 3, noSleep)).rejects.toBe(other);
    expect(calls).toBe(1);
    expect(isRetryableLockError({ errno: 1205 })).toBe(true);
    expect(isRetryableLockError({ driverError: { errno: 1020 } })).toBe(true);
  });
});
