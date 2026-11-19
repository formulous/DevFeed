import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { useAuth } from './AuthProvider';
import { FullPageSpinner } from '@/components/common/FullPageSpinner';
import { EmptyState } from '@/components/common/EmptyState';

export function safeRedirect(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, signedOutByUser } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'guest') {
    if (signedOutByUser) return <Navigate to="/" replace />;
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  return (
    <RequireAuth>
      {me?.role === 'ADMIN' ? children : <EmptyState title="접근 권한이 없음" description="관리자만 볼 수 있는 화면임" />}
    </RequireAuth>
  );
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const [params] = useSearchParams();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'member') {
    const raw = params.get('redirect');
    const target = safeRedirect(raw);
    if (me && !me.onboardingCompleted) {
      return <Navigate to={raw ? `/onboarding/tags?redirect=${encodeURIComponent(target)}` : '/onboarding/tags'} replace />;
    }
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
