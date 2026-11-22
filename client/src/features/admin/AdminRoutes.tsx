import { NavLink, Outlet, Route, Routes } from 'react-router';
import { cn } from '@/lib/cn';
import { NotFoundPage } from '@/features/common/NotFoundPage';
import { AdminDashboardPage } from './AdminDashboardPage';
import { SourceDetailPage } from './SourceDetailPage';
import { SourceFormPage } from './SourceFormPage';
import { ReportsPage } from './ReportsPage';
import { TagDictionaryPage } from './TagDictionaryPage';

function AdminLayout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('text-sm font-medium', isActive ? 'text-brand' : 'text-fg-secondary hover:text-fg');
  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-line pb-3" aria-label="관리자">
        <NavLink to="/admin" end className={link}>수집 현황</NavLink>
        <NavLink to="/admin/sources/new" className={link}>소스 추가</NavLink>
        <NavLink to="/admin/tags" className={link}>태그 사전</NavLink>
        <NavLink to="/admin/reports" className={link}>신고 관리</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="sources/new" element={<SourceFormPage />} />
        <Route path="sources/:id" element={<SourceDetailPage />} />
        <Route path="sources/:id/edit" element={<SourceFormPage />} />
        <Route path="tags" element={<TagDictionaryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
