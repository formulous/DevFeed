import { useEffect, useState, type FormEvent } from 'react';
import { FiSearch } from 'react-icons/fi';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 50;

function SearchBox() {
  const [params] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [value, setValue] = useState(urlQuery);
  const navigate = useNavigate();

  useEffect(() => setValue(urlQuery), [urlQuery]);
  const trimmed = value.trim();
  const valid = trimmed.length >= SEARCH_MIN;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-md">
      <input
        type="search"
        value={value}
        maxLength={SEARCH_MAX}
        onChange={(e) => setValue(e.target.value)}
        placeholder="기술 글 검색"
        aria-label="검색어"
        className="h-9 w-full rounded-lg border border-line bg-white pl-3 pr-9 text-sm focus:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200/30"
      />
      <button
        type="submit"
        disabled={!valid}
        aria-label="검색"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-secondary disabled:text-fg-muted"
      >
        <FiSearch size={16} />
      </button>
      {trimmed.length === 1 && <p className="absolute mt-1 text-xs text-fg-muted">2자 이상 입력해야 함</p>}
    </form>
  );
}

const TABS = [
  { to: '/', label: '최신', end: true },
  { to: '/for-you', label: '추천', end: false },
  { to: '/popular', label: '인기', end: false },
];

function ProfileMenu() {
  const { status, me, logout } = useAuth();
  if (status === 'loading') return <div className="h-8 w-16" />;
  if (status === 'guest') {
    return (
      <Link to="/login" className="shrink-0 text-sm font-medium text-fg-secondary hover:text-brand">
        로그인
      </Link>
    );
  }
  return (
    <details className="relative shrink-0">
      <summary className="max-w-[8rem] cursor-pointer list-none truncate text-sm font-medium">{me?.nickname} ▾</summary>
      <ul className="absolute right-0 z-20 mt-2 w-36 rounded-lg border border-line bg-surface py-1 text-sm shadow-lg">
        <li><Link className="block px-3 py-2 hover:bg-slate-50" to="/me/bookmarks">북마크</Link></li>
        <li><Link className="block px-3 py-2 hover:bg-slate-50" to="/me/history">읽은 기록</Link></li>
        <li><Link className="block px-3 py-2 hover:bg-slate-50" to="/me/settings">설정</Link></li>
        {me?.role === 'ADMIN' && (
          <li><Link className="block px-3 py-2 hover:bg-slate-50" to="/admin">관리자</Link></li>
        )}
        <li>
          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => logout()}>
            로그아웃
          </button>
        </li>
      </ul>
    </details>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 pt-3">
        <Link to="/" className="shrink-0 text-lg font-bold text-brand">
          DevFeed
        </Link>
        <SearchBox />
        <div className="ml-auto shrink-0 whitespace-nowrap">
          <ProfileMenu />
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1200px] gap-5 px-4" aria-label="피드">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'border-b-2 py-2.5 text-sm font-medium',
                isActive ? 'border-brand text-brand' : 'border-transparent text-fg-secondary hover:text-fg',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
