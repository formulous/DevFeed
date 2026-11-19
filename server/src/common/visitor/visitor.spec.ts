import { resolveVisitorId, viewerKey, visitorCookie } from './visitor';

describe('visitor', () => {
  it('유효한 df_vid가 있으면 재사용하고 없거나 잘못되면 새로 발급함', () => {
    const id = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
    expect(resolveVisitorId(`a=1; df_vid=${id}`)).toEqual({ id, issued: false });
    const fresh = resolveVisitorId('df_vid=not-a-uuid');
    expect(fresh.issued).toBe(true);
    expect(fresh.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveVisitorId(undefined).issued).toBe(true);
  });

  it('쿠키 속성', () => {
    expect(visitorCookie('x', false)).toBe('df_vid=x; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax');
    expect(visitorCookie('x', true)).toContain('; Secure');
  });

  it('viewer key는 회원·비회원을 구분하는 16바이트 해시', () => {
    const member = viewerKey({ userId: 1 });
    expect(member).toHaveLength(16);
    expect(member.equals(viewerKey({ userId: 1 }))).toBe(true);
    expect(member.equals(viewerKey({ visitorId: '1' }))).toBe(false);
  });
});
