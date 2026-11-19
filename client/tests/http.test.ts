import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, getAccessToken, request, setAccessToken } from '@/api/http';
import { server } from '@/mocks/node';

describe('http request', () => {
  it('TOKEN_EXPIRED면 refresh 1회 후 재시도함', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('*/api/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: 'new-token', expiresIn: 900, user: null });
      }),
      http.get('*/api/ping', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new-token'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'TOKEN_EXPIRED', message: '만료' }, { status: 401 }),
      ),
    );
    setAccessToken('old-token');
    const [a, b] = await Promise.all([request('/ping'), request('/ping')]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe('new-token');
  });

  it('refresh 실패 시 게스트로 재요청함', async () => {
    server.use(
      http.get('*/api/ping', ({ request }) =>
        request.headers.get('Authorization')
          ? HttpResponse.json({ code: 'TOKEN_EXPIRED', message: '만료' }, { status: 401 })
          : HttpResponse.json({ guest: true }),
      ),
    );
    setAccessToken('old-token');
    expect(await request('/ping')).toEqual({ guest: true });
    expect(getAccessToken()).toBeNull();
  });

  it('오류 응답을 ApiError로 변환함', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ code: 'LOGIN_LOCKED', message: '잠김', retryAfterSec: 300 }, { status: 423 }),
      ),
    );
    const err = (await request("/auth/login", { method: "POST", json: {} }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('LOGIN_LOCKED');
    expect(err.body.retryAfterSec).toBe(300);
  });
});
