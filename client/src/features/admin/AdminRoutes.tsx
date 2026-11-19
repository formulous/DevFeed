import { NavLink, Outlet, Route, Routes } from 'react-router';
import { cn } from '@/lib/cn';
import { PlaceholderPage } from '@/features/common/PlaceholderPage';
import { NotFoundPage } from '@/features/common/NotFoundPage';

function AdminLayout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('text-sm font-medium', isActive ? 'text-brand' : 'text-fg-secondary hover:text-fg');
  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-line pb-3" aria-label="관리자">
        <NavLink to="/admin" end className={link}>수집 현황</NavLink>
        <NavLink to="/admin/sources/new" className={link}>소스 추가</NavLink>
        <NavLink to="/admin/tags" className={link}>태그 사전</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<PlaceholderPage screenId="A-01" title="수집 현황" />} />
        <Route path="sources/new" element={<PlaceholderPage screenId="A-03" title="소스 등록" />} />
        <Route path="sources/:id" element={<PlaceholderPage screenId="A-02" title="소스 상세" />} />
        <Route path="sources/:id/edit" element={<PlaceholderPage screenId="A-03" title="소스 수정" />} />
        <Route path="tags" element={<PlaceholderPage screenId="A-04" title="태그 사전" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
