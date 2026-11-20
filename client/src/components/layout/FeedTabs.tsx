import { Fragment, useEffect, useRef, type RefObject } from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router';
import { cn } from '@/lib/cn';
import { M7_API_READY } from '@/lib/features';
import { FIELDS, parseField } from '@/lib/fields';
import { SearchBox } from './AppHeader';

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

const HERO_TITLES: Record<string, string> = {
  ...Object.fromEntries(FEED_TABS.map((t) => [t.to, t.label])),
  '/search': '검색',
};

export function heroTitle(pathname: string): string | null {
  return HERO_TITLES[pathname] ?? null;
}

const FADE =
  '[mask-image:linear-gradient(to_right,transparent,#000_12px,#000_calc(100%-16px),transparent)] lg:[mask-image:none]';

const FOCUS = 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring';

const ACTIVE = '[aria-current="page"], [aria-checked="true"]';

function useScrollActiveIntoView(ref: RefObject<HTMLElement | null>, dep: string) {
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(ACTIVE);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [ref, dep]);
}

export function isFieldTab(pathname: string) {
  return M7_API_READY && FEED_TABS.some((t) => t.field && t.to === pathname);
}

export function FeedTabs() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const field = isFieldTab(pathname) ? parseField(params.get('field')) : null;
  const ref = useRef<HTMLElement>(null);
  useScrollActiveIntoView(ref, pathname);

  return (
    <nav
      ref={ref}
      aria-label="피드"
      className={cn('scrollbar-none -mx-4 flex items-center gap-5 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-0', FADE)}
    >
      {FEED_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.field && field ? `${tab.to}?field=${field.key}` : tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            cn(
              'shrink-0 whitespace-nowrap py-1 text-[15px] transition-colors duration-150',
              FOCUS,
              isActive ? 'font-semibold text-fg' : 'font-medium text-fg-secondary hover:text-fg',
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
  const ref = useRef<HTMLDivElement>(null);
  useScrollActiveIntoView(ref, `${pathname}:${current?.key ?? ''}`);
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
      className={cn('scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-0', FADE)}
    >
      {options.map((o, i) => {
        const on = (current?.key ?? null) === o.key;
        return (
          <Fragment key={o.label}>
            {i > 0 && (
              <span aria-hidden className="shrink-0 select-none text-[13px] text-fg-muted">
                ·
              </span>
            )}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => select(o.key)}
              className={cn(
                'shrink-0 whitespace-nowrap py-0.5 text-[13px] transition-colors duration-150',
                FOCUS,
                on ? 'font-semibold text-fg' : 'text-fg-secondary hover:text-fg',
              )}
            >
              {o.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

export function PageHero({ title }: { title: string }) {
  return (
    <div className="border-b border-line">
      <div className="mx-auto max-w-[1200px] px-4 pb-3 pt-5 lg:pt-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SearchBox className="w-full lg:order-last lg:w-80" />
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-fg lg:text-[40px]">{title}</h1>
        </div>
        <div className="mt-3 lg:mt-5">
          <FeedTabs />
        </div>
      </div>
    </div>
  );
}
