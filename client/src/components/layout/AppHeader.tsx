import { HOME } from '@/lib/routes';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { FiSearch } from 'react-icons/fi';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/profile/Avatar';
import { GradeBadge } from '@/components/profile/GradeBadge';
import { useProfile } from '@/hooks/useProfile';
import { ThemeToggle } from './ThemeToggle';
import { Wordmark } from '@/components/auth/LogoMark';

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 50;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring';

export function SearchBox({ className }: { className?: string }) {
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
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <button
        type="submit"
        disabled={!valid}
        aria-label="검색"
        className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary disabled:text-fg-muted"
      >
        <FiSearch size={15} aria-hidden />
      </button>
      <input
        type="search"
        value={value}
        maxLength={SEARCH_MAX}
        onChange={(e) => setValue(e.target.value)}
        placeholder="기술 글 검색…"
        aria-label="검색어"
        className="h-10 w-full rounded-full border border-line bg-input pl-9 pr-4 text-sm text-fg placeholder:text-fg-muted transition-colors focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus"
      />
      {trimmed.length === 1 && <p className="absolute left-4 mt-1 text-xs text-fg-muted">2자 이상 입력해 주세요</p>}
    </form>
  );
}

function ProfileMenu() {
  const { status, me, logout } = useAuth();
  const profile = useProfile();
  if (status === 'loading') return <div className="h-8 w-16" />;
  if (status === 'guest') {
    return (
      <Link
        to="/login"
        className={cn('flex h-8 shrink-0 items-center rounded-full bg-inverse px-3.5 text-sm font-medium text-on-inverse hover:opacity-90', FOCUS)}
      >
        로그인
      </Link>
    );
  }
  const item = 'block px-3 py-2 hover:bg-hover';
  return (
    <details className="relative shrink-0">
      <summary className="flex h-8 max-w-[9rem] cursor-pointer list-none items-center truncate rounded-full px-2 text-sm font-medium text-fg-secondary hover:text-fg">
        {me?.nickname} ▾
      </summary>
      <ul className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-line bg-surface py-1 text-sm shadow-pop lg:w-36">
        {profile.data && (
          <li data-testid="menu-profile" className="mb-1 flex items-center gap-2 border-b border-line px-3 pb-2.5 pt-2 lg:hidden">
            <Avatar nickname={profile.data.nickname} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-fg">{profile.data.nickname}</span>
              <GradeBadge grade={profile.data.grade} small />
            </span>
          </li>
        )}
        <li><Link className={item} to="/me/bookmarks">북마크</Link></li>
        <li><Link className={item} to="/me/history">읽은 기록</Link></li>
        <li><Link className={item} to="/me/settings">설정</Link></li>
        {me?.role === 'ADMIN' && (
          <li><Link className={item} to="/admin">관리자</Link></li>
        )}
        <li>
          <button type="button" className={cn(item, 'w-full text-left')} onClick={() => logout()}>
            로그아웃
          </button>
        </li>
      </ul>
    </details>
  );
}

function useHeaderHeightVar() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ref;
}

export function AppHeader({ showSearchLink = false }: { showSearchLink?: boolean }) {
  const ref = useHeaderHeightVar();
  return (
    <header ref={ref} className="sticky top-0 z-30 border-b border-line bg-[color:color-mix(in_srgb,var(--color-bg-app)_85%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4">
        <Link to={HOME} aria-label="formulous 홈" className={cn('mr-auto shrink-0 rounded text-lg font-semibold tracking-tight text-fg', FOCUS)}>
          <Wordmark />
        </Link>
        {showSearchLink && (
          <Link
            to="/search"
            aria-label="검색으로 이동"
            className={cn('flex h-8 w-8 items-center justify-center rounded-full text-fg-secondary hover:bg-hover hover:text-fg', FOCUS)}
          >
            <FiSearch size={16} aria-hidden />
          </Link>
        )}
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
