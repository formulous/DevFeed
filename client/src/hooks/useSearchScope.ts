import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { parseScope, readLastScope, rememberScope, scopeOfPath, type SearchScopeKey } from '@/lib/searchScope';

export function useSearchScope(): SearchScopeKey {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const explicit = pathname === '/search' ? parseScope(params.get('scope')) : scopeOfPath(pathname);
  const scope = explicit ?? readLastScope();
  useEffect(() => {
    if (explicit) rememberScope(explicit);
  }, [explicit]);
  return scope;
}
