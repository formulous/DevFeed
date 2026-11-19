import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppHeader } from './AppHeader';

export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
