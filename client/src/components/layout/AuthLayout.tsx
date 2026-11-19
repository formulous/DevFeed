import { Link, Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export function AuthLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center px-4 py-12">
      <Link to="/" className="mb-8 text-2xl font-bold text-brand">
        DevFeed
      </Link>
      <main className="w-full max-w-md">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
