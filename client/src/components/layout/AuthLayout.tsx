import { Link, Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center px-4 py-12">
      <Link to="/" className="mb-8 text-2xl font-bold text-brand">
        DevFeed
      </Link>
      <main className="w-full max-w-md">
        <Outlet />
      </main>
    </div>
  );
}
