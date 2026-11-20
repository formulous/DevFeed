import type { ApiErrorBody, AuthResponse, Me } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.body = body;
  }
}

type QueryValue = string | number | boolean | undefined | null | Array<string | number>;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, QueryValue>;
  json?: unknown;
}

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let authLostListener: (() => void) | null = null;
let refreshedUser: Me | null = null;

export function takeRefreshedUser() {
  const user = refreshedUser;
  refreshedUser = null;
  return user;
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function onAuthLost(listener: (() => void) | null) {
  authLostListener = listener;
}

export function apiUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${import.meta.env.BASE_URL}api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        if (value.length > 0) url.searchParams.set(key, value.join(','));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export function authHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(apiUrl('/auth/refresh'), { method: 'POST', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const body = (await res.json()) as AuthResponse;
        accessToken = body.accessToken;
        refreshedUser = body.user;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function toErrorBody(status: number, data: unknown): ApiErrorBody {
  if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
    return data as ApiErrorBody;
  }
  return { code: status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN', message: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요' };
}

export async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { query, json, headers: initHeaders, ...init } = options;
  const headers = authHeaders(initHeaders);
  if (json !== undefined) headers.set('Content-Type', 'application/json');

  const res = await fetch(apiUrl(path, query), {
    ...init,
    headers,
    credentials: 'same-origin',
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new ApiError(res.status, toErrorBody(res.status, data));
    if (error.code === 'TOKEN_EXPIRED' && !retried) {
      const token = await refreshAccessToken();
      if (!token) authLostListener?.();
      return request<T>(path, options, true);
    }
    throw error;
  }
  return data as T;
}
