import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { fetchProfile } from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';

export const PROFILE_KEY = ['me', 'profile'] as const;

export const profileQuery = queryOptions({
  queryKey: PROFILE_KEY,
  queryFn: fetchProfile,
  staleTime: 30_000,
});

export function refreshProfile(client: QueryClient) {
  return client.invalidateQueries({ queryKey: PROFILE_KEY });
}

export function useProfile() {
  const { status } = useAuth();
  return useQuery({ ...profileQuery, enabled: status === 'member' });
}

export function useRefreshProfile() {
  const client = useQueryClient();
  return () => refreshProfile(client);
}
