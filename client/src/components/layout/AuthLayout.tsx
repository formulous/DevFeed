import { Link, Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LogoMark } from '@/components/auth/LogoMark';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout() {
  const { pathname } = useLocation();
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-app">
      <div aria-hidden className="auth-glow pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <header className="relative flex h-14 items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
          <LogoMark size={20} />
          DevFeed
        </Link>
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        <ErrorBoundary resetKey={pathname}>
          <div key={pathname} className="auth-enter flex w-full flex-col items-center">
            <Outlet />
          </div>
        </ErrorBoundary>
      </main>
      <footer className="relative pb-6 text-center">
        <Link to="/privacy" className="text-xs text-fg-muted hover:text-fg-secondary">
          개인정보 안내
        </Link>
      </footer>
    </div>
  );
}
