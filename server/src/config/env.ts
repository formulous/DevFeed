export interface AppEnv {
  port: number;
  db: { host: string; port: number; username: string; password: string; database: string };
  jwt: { accessSecret: string; accessTtlSec: number };
  cookieSecure: boolean;
  crawl: { schedulerEnabled: boolean; concurrency: number };
  searchCacheEnabled: boolean;
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
  };
}

export const APP_ENV = Symbol('APP_ENV');
