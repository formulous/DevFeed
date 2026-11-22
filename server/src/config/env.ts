export interface AppEnv {
  port: number;
  db: { host: string; port: number; username: string; password: string; database: string };
  jwt: { accessSecret: string; accessTtlSec: number };
  cookieSecure: boolean;
  crawl: { schedulerEnabled: boolean; concurrency: number };
  searchCacheEnabled: boolean;
  rateLimitEnabled: boolean;
  webauthn: { rpId: string; rpName: string; origins: string[] };
  webBaseUrl: string;
  postNewAccountLimitEnabled: boolean;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value === '') throw new Error(`환경변수 ${key}가 필요함`);
  return value;
}

function int(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`환경변수 ${key}는 0 이상 정수여야 함`);
  return value;
}

function bool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]?.toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`환경변수 ${key}는 true 또는 false여야 함`);
}

function origins(env: NodeJS.ProcessEnv, key: string, fallback: string[]): string[] {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const list = raw.split(',').map((value) => value.trim()).filter(Boolean);
  for (const value of list) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`환경변수 ${key}의 ${value}는 URL이 아님`);
    }
    if (url.origin !== value) throw new Error(`환경변수 ${key}는 경로 없는 origin 목록이어야 함: ${value}`);
  }
  return list;
}

function baseUrl(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`환경변수 ${key}는 URL이어야 함`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`환경변수 ${key}는 http(s) URL이어야 함`);
  if (url.search || url.hash) throw new Error(`환경변수 ${key}에 쿼리·해시를 넣지 않음`);
  return raw.replace(/\/+$/, '');
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const accessSecret = required(env, 'JWT_ACCESS_SECRET');
  if (accessSecret.length < 32) throw new Error('JWT_ACCESS_SECRET은 32자 이상이어야 함');
  return {
    port: int(env, 'PORT', 3000),
    db: {
      host: env.DB_HOST || 'localhost',
      port: int(env, 'DB_PORT', 3306),
      username: required(env, 'DB_USERNAME'),
      password: env.DB_PASSWORD ?? '',
      database: env.DB_DATABASE || 'devfeed',
    },
    jwt: { accessSecret, accessTtlSec: int(env, 'JWT_ACCESS_TTL_SEC', 900) },
    cookieSecure: bool(env, 'COOKIE_SECURE', true),
    crawl: {
      schedulerEnabled: bool(env, 'CRAWL_SCHEDULER_ENABLED', true),
      concurrency: Math.max(1, int(env, 'CRAWL_CONCURRENCY', 5)),
    },
    searchCacheEnabled: bool(env, 'SEARCH_CACHE_ENABLED', true),
    rateLimitEnabled: bool(env, 'RATE_LIMIT_ENABLED', true),
    webauthn: {
      rpId: env.WEBAUTHN_RP_ID || 'localhost',
      rpName: env.WEBAUTHN_RP_NAME || 'DevFeed',
      origins: origins(env, 'WEBAUTHN_ORIGINS', ['http://localhost:5175']),
    },
    webBaseUrl: baseUrl(env, 'WEB_BASE_URL', 'http://localhost:5175'),
    postNewAccountLimitEnabled: bool(env, 'POST_NEW_ACCOUNT_LIMIT_ENABLED', false),
  };
}

export const APP_ENV = Symbol('APP_ENV');
