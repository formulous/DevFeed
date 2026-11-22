import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import type { SourceType } from '@/api/types';
import { GuestOnly, RequireAdmin, RequireAuth } from '@/auth/guards';
import { FullPageSpinner } from '@/components/common/FullPageSpinner';
import { AppLayout } from '@/components/layout/AppLayout';
import { PasskeyOfferPage } from '@/features/auth/PasskeyOfferPage';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { RouteTitle } from '@/components/layout/RouteTitle';
import { NotFoundPage } from '@/features/common/NotFoundPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { BookmarksPage } from '@/features/me/BookmarksPage';
import { HistoryPage } from '@/features/me/HistoryPage';
import { OnboardingPage } from '@/features/me/OnboardingPage';
import { SettingsPage } from '@/features/me/SettingsPage';
import { HomePage } from '@/features/feed/HomePage';
import { SecurityNewsPage } from '@/features/security/SecurityNewsPage';
import { SecurityPopularPage } from '@/features/security/SecurityPopularPage';
import { PATHS } from '@/lib/routes';
import { M7_API_READY } from '@/lib/features';
import { PopularPage } from '@/features/popular/PopularPage';
import { ForYouPage } from '@/features/recommend/ForYouPage';
import { SearchPage } from '@/features/search/SearchPage';
import { PrivacyPage } from '@/features/info/PrivacyPage';
import { CommunityPage } from '@/features/community/CommunityPage';
import { CommunityPopularPage } from '@/features/community/CommunityPopularPage';


const AdminRoutes = lazy(() => import('@/features/admin/AdminRoutes'));
const CommunityPostPage = lazy(() => import('@/features/community/CommunityPostPage').then((m) => ({ default: m.CommunityPostPage })));
const CommunityNewPage = lazy(() => import('@/features/community/CommunityEditorPage').then((m) => ({ default: m.CommunityNewPage })));
const CommunityEditPage = lazy(() => import('@/features/community/CommunityEditorPage').then((m) => ({ default: m.CommunityEditPage })));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>;
}

function LegacySourceTypeRedirect({ type }: { type: SourceType }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('sourceType', type);
  return <Navigate to={`${PATHS.tech}?${params.toString()}`} replace />;
}

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

export function App() {
  return (
    <>
      <RouteTitle />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LegacyRedirect to={PATHS.tech} />} />
          <Route path="for-you" element={<LegacyRedirect to={PATHS.techForYou} />} />
          <Route path="popular" element={<LegacyRedirect to={PATHS.techPopular} />} />
          <Route path="tech" element={<HomePage />} />
          <Route path="tech/for-you" element={<RequireAuth><ForYouPage /></RequireAuth>} />
          <Route path="tech/popular" element={<PopularPage />} />
          <Route path="company" element={<LegacySourceTypeRedirect type="COMPANY" />} />
          <Route path="personal" element={<LegacySourceTypeRedirect type="PERSONAL" />} />
          <Route path="security" element={M7_API_READY ? <SecurityNewsPage /> : <Navigate to={PATHS.tech} replace />} />
          <Route path="security/popular" element={M7_API_READY ? <SecurityPopularPage /> : <Navigate to={PATHS.tech} replace />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="community/popular" element={<CommunityPopularPage />} />
          <Route path="community/new" element={<RequireAuth><Lazy><CommunityNewPage /></Lazy></RequireAuth>} />
          <Route path="community/posts/:id" element={<Lazy><CommunityPostPage /></Lazy>} />
          <Route path="community/posts/:id/edit" element={<RequireAuth><Lazy><CommunityEditPage /></Lazy></RequireAuth>} />
          <Route path="search" element={<SearchPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="me/bookmarks" element={<RequireAuth><BookmarksPage /></RequireAuth>} />
          <Route path="me/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="me/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route
            path="admin/*"
            element={
              <RequireAdmin>
                <Suspense fallback={<FullPageSpinner />}>
                  <AdminRoutes />
                </Suspense>
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="signup" element={<GuestOnly><SignupPage /></GuestOnly>} />
          <Route path="onboarding/passkey" element={<RequireAuth><PasskeyOfferPage /></RequireAuth>} />
          <Route path="onboarding/tags" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        </Route>
      </Routes>
    </>
  );
}
