import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { heroTitle, PageHero } from './FeedTabs';

export function AppLayout() {
  const { pathname } = useLocation();
  const title = heroTitle(pathname);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader showSearchLink={!title} />
      {title && <PageHero title={title} />}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 lg:py-8">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <AppFooter />
    </div>
  );
}
