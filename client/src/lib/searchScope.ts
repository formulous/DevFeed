import { PATHS } from './routes';

export type SearchScopeKey = 'tech' | 'security' | 'community';
export type ApiSearchScope = 'TECH' | 'SECURITY' | 'COMMUNITY';

export interface SearchScopeInfo {
  key: SearchScopeKey;
  api: ApiSearchScope;
  label: string;
  placeholder: string;
  hint: string;
  prefix: string;
}

export const SEARCH_SCOPES: SearchScopeInfo[] = [
  { key: 'community', api: 'COMMUNITY', label: '자유 게시판', placeholder: '자유 게시판에서 찾기', hint: '제목, 본문, 태그에서 찾아요', prefix: PATHS.community },
  { key: 'tech', api: 'TECH', label: '기술 뉴스', placeholder: '기술 뉴스에서 찾기', hint: '제목, 요약, 태그, 소스 이름에서 찾아요', prefix: PATHS.tech },
  { key: 'security', api: 'SECURITY', label: '보안 뉴스', placeholder: '보안 뉴스에서 찾기', hint: '제목, 요약, 출처 이름에서 찾아요', prefix: PATHS.security },
];

export const DEFAULT_SCOPE: SearchScopeKey = 'tech';

const STORAGE_KEY = 'devfeed:search-scope';

export function parseScope(value: string | null): SearchScopeKey {
  return SEARCH_SCOPES.some((s) => s.key === value) ? (value as SearchScopeKey) : DEFAULT_SCOPE;
}

export function scopeInfo(key: SearchScopeKey) {
  return SEARCH_SCOPES.find((s) => s.key === key) ?? SEARCH_SCOPES.find((s) => s.key === DEFAULT_SCOPE)!;
}

export function scopeOfPath(pathname: string): SearchScopeKey | null {
  const hit = SEARCH_SCOPES.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  return hit?.key ?? null;
}

export function readLastScope(): SearchScopeKey {
  try {
    return parseScope(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SCOPE;
  }
}

export function rememberScope(key: SearchScopeKey) {
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    return;
  }
}

export function searchPath(q: string, scope: SearchScopeKey) {
  const params = new URLSearchParams({ q });
  if (scope !== DEFAULT_SCOPE) params.set('scope', scope);
  return `/search?${params.toString()}`;
}
