import { api, cleanup, signup, startApp, TestApp } from './support/app';

describe('사용자 표시 오류 메시지는 해요체 (024)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startApp();
  });

  afterAll(async () => {
    await cleanup(t);
    await t.close();
  });

  it('검증·인증·404·충돌 메시지가 해요체이고 code는 그대로', async () => {
    const user = await signup(t, 'tone');
    const responses = [
      await api(t, 'POST', '/auth/signup', { body: { email: 'not-email', password: 'short', nickname: 'a' } }),
      await api(t, 'POST', '/auth/signup', { body: { email: user.email, password: 'pass1234', nickname: '중복확인' } }),
      await api(t, 'POST', '/auth/login', { body: { email: user.email, password: 'wrong1234' } }),
      await api(t, 'GET', '/me/bookmarks'),
      await api(t, 'GET', '/search?q=a'),
      await api(t, 'GET', '/posts?cursor=zzz'),
      await api(t, 'GET', '/posts?field=nope'),
      await api(t, 'GET', '/no-such-path'),
      await api(t, 'POST', '/posts/999999999/views'),
    ];
    expect(responses.map((r) => r.body.code)).toEqual([
      'VALIDATION_FAILED',
      'EMAIL_DUPLICATED',
      'INVALID_CREDENTIALS',
      'UNAUTHENTICATED',
      'VALIDATION_FAILED',
      'INVALID_CURSOR',
      'VALIDATION_FAILED',
      'NOT_FOUND',
      'NOT_FOUND',
    ]);
    const messages = responses.flatMap((r) => [r.body.message, ...(r.body.fieldErrors ?? []).map((e: { message: string }) => e.message)]);
    for (const message of messages) expect(message).toMatch(/(요|세요|\(공백·한글 불가\))$/);
    expect(responses[1].body.message).toBe('이미 가입된 이메일이에요');
    expect(responses[3].body.message).toBe('로그인이 필요해요');
    expect(responses[0].body.fieldErrors.find((e: { field: string }) => e.field === 'nickname').message).toBe('2~20자로 입력해 주세요');
  });
});
