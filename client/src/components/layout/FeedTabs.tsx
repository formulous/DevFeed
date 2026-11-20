import { useEffect, useRef } from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router';
import { cn } from '@/lib/cn';
import { M7_API_READY } from '@/lib/features';
import { FIELDS, parseField } from '@/lib/fields';

interface TabDef {
  to: string;
  label: string;
  field: boolean;
}

const ALL_TABS: TabDef[] = [
  { to: '/', label: '최신', field: true },
  { to: '/for-you', label: '추천', field: false },
  { to: '/popular', label: '인기', field: true },
  { to: '/company', label: '기업 블로그', field: true },
  { to: '/personal', label: '개인 블로그', field: true },
  { to: '/security', label: '보안 뉴스', field: false },
];

export const FEED_TABS = M7_API_READY ? ALL_TABS : ALL_TABS.filter((t) => t.to !== '/security');

const FADE =
  '[mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] lg:[mask-image:none]';

function useRevealActive<T extends HTMLElement>(dep: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"], [aria-checked="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [dep]);
  return ref;
}

export function isFieldTab(pathname: string) {
  return M7_API_READY && FEED_TABS.some((t) => t.field && t.to === pathname);
}

export function FeedTabs() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const field = isFieldTab(pathname) ? parseField(params.get('field')) : null;
  const ref = useRevealActive<HTMLElement>(pathname);

  return (
    <nav ref={ref} aria-label="피드" className={cn('scrollbar-none flex overflow-x-auto px-2 lg:gap-2 lg:px-0', FADE)}>
      {FEED_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.field && field ? `${tab.to}?field=${field.key}` : tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex h-12 shrink-0 items-center whitespace-nowrap border-b-[3px] px-3 text-[15px] sm:text-base',
              isActive ? 'border-brand font-bold text-fg' : 'border-transparent font-medium text-fg-secondary hover:text-fg',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function FieldTabs() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const current = parseField(params.get('field'));
  const ref = useRevealActive<HTMLDivElement>(`${pathname}:${current?.key ?? ''}`);
  if (!isFieldTab(pathname)) return null;

  const select = (key: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key) next.set('field', key);
        else next.delete('field');
        return next;
      },
      { replace: true },
    );

  const options = [{ key: null, label: '전체' }, ...FIELDS.map((f) => ({ key: f.key as string | null, label: f.label }))];

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="분야"
      className={cn('scrollbar-none flex gap-1.5 overflow-x-auto px-4 py-2 lg:px-0', FADE)}
    >
      {options.map((o) => {
        const on = (current?.key ?? null) === o.key;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => select(o.key)}
            className={cn(
              'h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors',
              on ? 'bg-slate-800 font-semibold text-white' : 'bg-slate-100 text-fg-secondary hover:bg-slate-200 hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
