import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '@/api/auth';
import { onAuthLost, refreshAccessToken, setAccessToken, takeRefreshedUser } from '@/api/http';
import { signup as signupApi } from '@/api/me';
import type { AuthResponse, Me, SignupInput } from '@/api/types';

type AuthStatus = 'loading' | 'guest' | 'member';

interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  signedOutByUser: boolean;
  login: (email: string, password: string) => Promise<Me>;
  signup: (input: SignupInput) => Promise<Me>;
  logout: () => Promise<void>;
  updateMe: (patch: Partial<Me>) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [signedOutByUser, setSignedOutByUser] = useState(false);

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

  const startSession = useCallback(
    ({ accessToken, user }: AuthResponse) => {
      setAccessToken(accessToken);
      setMe(user);
      setStatus('member');
      setSignedOutByUser(false);
      client.invalidateQueries();
      return user;
    },
    [client],
  );

  const login = useCallback(
    async (email: string, password: string) => startSession(await authApi.login(email, password)),
    [startSession],
  );

  const signup = useCallback(async (input: SignupInput) => startSession(await signupApi(input)), [startSession]);

  const updateMe = useCallback((patch: Partial<Me>) => setMe((prev) => (prev ? { ...prev, ...patch } : prev)), []);

  const clearSession = useCallback(() => {
    setSignedOutByUser(true);
    becomeGuest();
    client.clear();
  }, [becomeGuest, client]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, me, signedOutByUser, login, signup, logout, updateMe, clearSession }),
    [status, me, signedOutByUser, login, signup, logout, updateMe, clearSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider 밖에서 useAuth 호출');
  return ctx;
}
