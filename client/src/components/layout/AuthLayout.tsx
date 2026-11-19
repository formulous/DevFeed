import { Link, Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppFooter } from './AppFooter';

export function AuthLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center px-4 pt-12">
      <Link to="/" className="mb-8 text-2xl font-bold text-brand">
        DevFeed
      </Link>
      <main className="w-full max-w-md flex-1 pb-12">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <AppFooter className="-mx-4 w-[calc(100%+2rem)]" />
    </div>
  );
}
