import { Link, Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppFooter } from './AppFooter';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout() {
  const { pathname } = useLocation();
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center px-4 pt-12">
      <div className="absolute right-4 top-3">
        <ThemeToggle />
      </div>
      <Link to="/" className="mb-8 text-2xl font-bold tracking-tight text-fg">
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
