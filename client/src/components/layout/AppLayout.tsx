import { Outlet } from 'react-router';
import { AppHeader } from './AppHeader';

export function AppLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
