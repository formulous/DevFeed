import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { FieldTabs, isFieldTab } from './FeedTabs';

export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader />
      {isFieldTab(pathname) && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto max-w-[1200px] lg:px-4">
            <FieldTabs />
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <AppFooter />
    </div>
  );
}
