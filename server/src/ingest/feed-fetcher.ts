import { retryDelayMs } from './backoff';

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_RETRIES = 3;
export const MAX_FEED_BYTES = 20 * 1024 * 1024;
const USER_AGENT = 'DevFeedBot/0.1';

export interface FetchFeedOptions {
  etag?: string | null;
  lastModified?: string | null;
}

export type FetchFeedResult =
  | { kind: 'not_modified'; status: 304; attempts: number }
  | {
      kind: 'ok';
      status: number;
      body: string;
      etag: string | null;
      lastModified: string | null;
      attempts: number;
    };

export class FeedFetchError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly attempts: number,
  ) {
    super(message);
  }
}

class RetryableError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface FetcherDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
  retryBaseMs: number;
  maxRetries: number;
}

const defaultDeps: FetcherDeps = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs: FETCH_TIMEOUT_MS,
  retryBaseMs: 1000,
  maxRetries: MAX_RETRIES,
};

function detectCharset(contentType: string | null, head: Uint8Array): string {
  const fromHeader = /charset\s*=\s*"?([\w-]+)/i.exec(contentType ?? '')?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const prolog = new TextDecoder('latin1').decode(head.subarray(0, 200));
  const fromXml = /<\?xml[^>]*encoding\s*=\s*["']([\w-]+)["']/i.exec(prolog)?.[1];
  return (fromXml ?? 'utf-8').toLowerCase();
}

function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const charset = detectCharset(contentType, bytes);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_FEED_BYTES) throw new RetryableError('피드 크기 초과 (20MB)', response.status, false);
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new RetryableError('피드 크기 초과 (20MB)', response.status, false);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function describe(error: unknown): string {
  const e = error as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'timeout';
  return e?.cause?.code ?? e?.cause?.message ?? e?.message ?? 'network error';
}

export async function fetchFeed(
  url: string,
  options: FetchFeedOptions = {},
  deps: Partial<FetcherDeps> = {},
): Promise<FetchFeedResult> {
  const d = { ...defaultDeps, ...deps };
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
  };
  if (options.etag) headers['If-None-Match'] = options.etag;
  if (options.lastModified) headers['If-Modified-Since'] = options.lastModified;

  let lastError: RetryableError = new RetryableError('unknown', null, true);
  for (let attempt = 1; attempt <= d.maxRetries + 1; attempt++) {
    try {
      const response = await d.fetch(url, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(d.timeoutMs),
      });
      if (response.status === 304) return { kind: 'not_modified', status: 304, attempts: attempt };
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429 || response.status === 408;
        await response.body?.cancel().catch(() => undefined);
        throw new RetryableError(`HTTP ${response.status}`, response.status, retryable);
      }
      const bytes = await readLimited(response);
      return {
        kind: 'ok',
        status: response.status,
        body: decodeBody(bytes, response.headers.get('content-type')),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
        attempts: attempt,
      };
    } catch (error) {
      lastError =
        error instanceof RetryableError ? error : new RetryableError(describe(error), null, true);
      if (!lastError.retryable || attempt > d.maxRetries) {
        throw new FeedFetchError(lastError.message, lastError.status, attempt);
      }
      await d.sleep(retryDelayMs(attempt, d.retryBaseMs));
    }
  }
  throw new FeedFetchError(lastError.message, lastError.status, d.maxRetries + 1);
}
