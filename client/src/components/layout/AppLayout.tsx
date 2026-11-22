import { Outlet, useLocation } from 'react-router';
import { SideAd } from '@/components/ads/SideAd';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AD_MEDIA, AD_SLOTS, HOVER_MENU_MEDIA, useMediaQuery } from '@/lib/ads';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { WriteButton } from '@/features/community/WriteButton';
import { CategoryTabs, FieldTabs, heroTitle, isCategoryTab, isFieldTab, PageHero, SectionTabs, sectionOf, SortSelect } from './FeedTabs';

export function AppLayout() {
  const { pathname } = useLocation();
  const title = heroTitle(pathname);
  const wide = useMediaQuery(AD_MEDIA);
  const showAds = Boolean(title) && wide;
  const section = sectionOf(pathname);
  const hoverable = useMediaQuery(HOVER_MENU_MEDIA);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader showSearchLink={!title} />
      {title && <PageHero title={title} />}
      <div className="flex w-full flex-1 justify-center gap-6 min-[1440px]:px-4">
        {showAds && <SideAd slot={AD_SLOTS.left} />}
        <main className="w-full min-w-0 max-w-[1200px] flex-1 px-4 py-6 lg:py-8">
          {section && hoverable && (
            <div className="-mt-2 mb-5 flex min-h-8 items-center gap-3 lg:-mt-3 lg:mb-6">
              <div className="min-w-0 flex-1">
                {isFieldTab(pathname) && <FieldTabs />}
                {isCategoryTab(pathname) && <CategoryTabs />}
              </div>
              {section.key === 'community' && <WriteButton />}
              <SortSelect />
            </div>
          )}
          {section && !hoverable && (
            <div className="-mt-2 mb-5 space-y-2.5 lg:-mt-3 lg:mb-6">
              <div className="flex items-center justify-between gap-3">
                <SectionTabs />
                {section.key === 'community' && <WriteButton />}
              </div>
              {isFieldTab(pathname) && <FieldTabs />}
              {isCategoryTab(pathname) && <CategoryTabs />}
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
