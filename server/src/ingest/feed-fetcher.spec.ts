import { FeedFetchError, fetchFeed } from './feed-fetcher';

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
  return new Response(status === 304 ? null : body, { status, headers });
}

function deps(responses: (Response | Error)[]) {
  const calls: RequestInit[] = [];
  const sleeps: number[] = [];
  return {
    calls,
    sleeps,
    deps: {
      fetch: jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        calls.push(init ?? {});
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next!;
      }) as unknown as typeof fetch,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      retryBaseMs: 10,
    },
  };
}

describe('fetchFeed', () => {
  it('조건부 요청 헤더를 보내고 304면 not_modified', async () => {
    const t = deps([response(304)]);
    const result = await fetchFeed('https://a.com/feed', { etag: '"v1"', lastModified: 'Wed' }, t.deps);
    expect(result).toEqual({ kind: 'not_modified', status: 304, attempts: 1 });
    const headers = t.calls[0].headers as Record<string, string>;
    expect(headers['If-None-Match']).toBe('"v1"');
    expect(headers['If-Modified-Since']).toBe('Wed');
  });

  it('5xx·네트워크 오류는 지수 백오프로 최대 3회 재시도함', async () => {
    const t = deps([response(503), new TypeError('fetch failed'), response(500), response(200, '<rss/>', { etag: 'e' })]);
    const result = await fetchFeed('https://a.com/feed', {}, t.deps);
    expect(result).toMatchObject({ kind: 'ok', attempts: 4, etag: 'e', body: '<rss/>' });
    expect(t.sleeps).toEqual([10, 20, 40]);
  });

  it('재시도를 다 쓰면 FeedFetchError', async () => {
    const t = deps([response(500), response(500), response(500), response(502)]);
    await expect(fetchFeed('https://a.com/feed', {}, t.deps)).rejects.toMatchObject({
      message: 'HTTP 502',
      status: 502,
      attempts: 4,
    });
  });

  it('404는 재시도하지 않음', async () => {
    const t = deps([response(404)]);
    const error = await fetchFeed('https://a.com/feed', {}, t.deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FeedFetchError);
    expect(error).toMatchObject({ status: 404, attempts: 1 });
  });

  it('타임아웃은 timeout 메시지로 기록함', async () => {
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    const t = deps([timeout]);
    await expect(fetchFeed('https://a.com/feed', {}, { ...t.deps, maxRetries: 0 })).rejects.toMatchObject({
      message: 'timeout',
      attempts: 1,
    });
  });

  it('EUC-KR 피드를 charset 선언에 맞춰 디코딩함', async () => {
    const eucKrBytes = new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]);
    const body = new Uint8Array([
      ...new TextEncoder().encode('<?xml version="1.0" encoding="EUC-KR"?><rss>'),
      ...eucKrBytes,
      ...new TextEncoder().encode('</rss>'),
    ]);
    const t = deps([new Response(body, { status: 200, headers: { 'content-type': 'application/xml' } })]);
    const result = await fetchFeed('https://a.com/feed', {}, t.deps);
    expect(result.kind === 'ok' && result.body).toContain('한글');
  });
});
