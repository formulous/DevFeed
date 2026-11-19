import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '@/api/auth';
import { onAuthLost, refreshAccessToken, setAccessToken, takeRefreshedUser } from '@/api/http';
import type { Me } from '@/api/types';

type AuthStatus = 'loading' | 'guest' | 'member';

interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const becomeGuest = useCallback(() => {
    setAccessToken(null);
    setMe(null);
    setStatus('guest');
  }, []);

  useEffect(() => {
    onAuthLost(() => {
      becomeGuest();
      client.invalidateQueries();
    });
    let cancelled = false;
    refreshAccessToken()
      .then((token) => (token ? (takeRefreshedUser() ?? authApi.fetchMe()) : null))
      .then((user) => {
        if (cancelled) return;
        if (user) {
          setMe(user);
          setStatus('member');
        } else {
          becomeGuest();
        }
      })
      .catch(() => !cancelled && becomeGuest());
    return () => {
      cancelled = true;
      onAuthLost(null);
    };
  }, [becomeGuest, client]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken, user } = await authApi.login(email, password);
      setAccessToken(accessToken);
      setMe(user);
      setStatus('member');
      client.invalidateQueries();
      return user;
    },
    [client],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    becomeGuest();
    client.clear();
  }, [becomeGuest, client]);

  const value = useMemo(() => ({ status, me, login, logout }), [status, me, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider 밖에서 useAuth 호출');
  return ctx;
}
