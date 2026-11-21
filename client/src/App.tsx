import { lazy, Suspense } from 'react';
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
import { M7_API_READY } from '@/lib/features';
import { PopularPage } from '@/features/popular/PopularPage';
import { ForYouPage } from '@/features/recommend/ForYouPage';
import { SearchPage } from '@/features/search/SearchPage';
import { PrivacyPage } from '@/features/info/PrivacyPage';

const AdminRoutes = lazy(() => import('@/features/admin/AdminRoutes'));

function LegacySourceTypeRedirect({ type }: { type: SourceType }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('sourceType', type);
  return <Navigate to={`/?${params.toString()}`} replace />;
}

export function App() {
  return (
    <>
      <RouteTitle />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="company" element={<LegacySourceTypeRedirect type="COMPANY" />} />
          <Route path="personal" element={<LegacySourceTypeRedirect type="PERSONAL" />} />
          <Route path="security" element={M7_API_READY ? <SecurityNewsPage /> : <Navigate to="/" replace />} />
          <Route path="for-you" element={<RequireAuth><ForYouPage /></RequireAuth>} />
          <Route path="popular" element={<PopularPage />} />
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
