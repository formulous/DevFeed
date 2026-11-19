import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { GuestOnly, RequireAdmin, RequireAuth } from '@/auth/guards';
import { FullPageSpinner } from '@/components/common/FullPageSpinner';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { NotFoundPage } from '@/features/common/NotFoundPage';
import { PlaceholderPage } from '@/features/common/PlaceholderPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { HomePage } from '@/features/feed/HomePage';
import { PopularPage } from '@/features/popular/PopularPage';
import { SearchPage } from '@/features/search/SearchPage';

const AdminRoutes = lazy(() => import('@/features/admin/AdminRoutes'));

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="for-you" element={<RequireAuth><PlaceholderPage screenId="S-02" title="추천 피드" /></RequireAuth>} />
        <Route path="popular" element={<PopularPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="me/bookmarks" element={<RequireAuth><PlaceholderPage screenId="S-08" title="북마크" /></RequireAuth>} />
        <Route path="me/history" element={<RequireAuth><PlaceholderPage screenId="S-09" title="읽은 기록" /></RequireAuth>} />
        <Route path="me/settings" element={<RequireAuth><PlaceholderPage screenId="S-10" title="설정" /></RequireAuth>} />
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
        <Route path="signup" element={<GuestOnly><PlaceholderPage screenId="S-06" title="회원가입" /></GuestOnly>} />
        <Route path="onboarding/tags" element={<RequireAuth><PlaceholderPage screenId="S-07" title="관심 태그 선택" /></RequireAuth>} />
      </Route>
    </Routes>
  );
}
