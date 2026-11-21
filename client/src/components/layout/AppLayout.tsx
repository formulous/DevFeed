import { Outlet, useLocation } from 'react-router';
import { SideAd } from '@/components/ads/SideAd';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AD_MEDIA, AD_SLOTS, useMediaQuery } from '@/lib/ads';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { FieldTabs, heroTitle, isFieldTab, PageHero } from './FeedTabs';

export function AppLayout() {
  const { pathname } = useLocation();
  const title = heroTitle(pathname);
  const wide = useMediaQuery(AD_MEDIA);
  const showAds = Boolean(title) && wide;
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader showSearchLink={!title} />
      {title && <PageHero title={title} />}
      <div className="flex w-full flex-1 justify-center gap-6 min-[1440px]:px-4">
        {showAds && <SideAd slot={AD_SLOTS.left} />}
        <main className="w-full min-w-0 max-w-[1200px] flex-1 px-4 py-6 lg:py-8">
          {isFieldTab(pathname) && (
            <div className="-mt-2 mb-5 lg:-mt-3 lg:mb-6">
              <FieldTabs />
            </div>
          )}
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        {showAds && <SideAd slot={AD_SLOTS.right} />}
      </div>
      <AppFooter />
    </div>
  );
}
