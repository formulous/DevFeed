import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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

const ACTIVE = '[aria-current="page"], [aria-checked="true"]';

function useSlidingIndicator<T extends HTMLElement>(dep: string) {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  const placed = useRef(false);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const place = () => {
      const el = box.querySelector<HTMLElement>(ACTIVE);
      if (!el) {
        placed.current = false;
        setStyle({ opacity: 0 });
        return;
      }
      setStyle({
        opacity: 1,
        width: el.offsetWidth,
        height: el.offsetHeight,
        transform: `translate(${el.offsetLeft}px, ${el.offsetTop}px)`,
        transitionProperty: placed.current ? 'transform, width, opacity' : 'none',
      });
      placed.current = true;
    };
    place();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(box);
    return () => ro.disconnect();
  }, [dep]);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(ACTIVE);
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [dep]);

  return { ref, style };
}

const INDICATOR = 'pointer-events-none absolute left-0 top-0 duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:duration-0';

export function isFieldTab(pathname: string) {
  return M7_API_READY && FEED_TABS.some((t) => t.field && t.to === pathname);
}

export function FeedTabs() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const field = isFieldTab(pathname) ? parseField(params.get('field')) : null;
  const { ref, style } = useSlidingIndicator<HTMLElement>(pathname);

  return (
    <nav
      ref={ref}
      aria-label="피드"
      className={cn('scrollbar-none relative isolate flex items-center gap-1 overflow-x-auto px-3 py-2 lg:px-0', FADE)}
    >
      <span aria-hidden className={cn(INDICATOR, '-z-10 rounded-full bg-brand-soft ring-1 ring-inset ring-blue-100')} style={style} />
      {FEED_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.field && field ? `${tab.to}?field=${field.key}` : tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              isActive ? 'font-semibold text-brand' : 'font-medium text-fg-secondary hover:bg-slate-100 hover:text-fg',
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
  const { ref, style } = useSlidingIndicator<HTMLDivElement>(`${pathname}:${current?.key ?? ''}`);
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
      className={cn('scrollbar-none overflow-x-auto px-4 py-2 lg:px-0', FADE)}
    >
      <div className="relative isolate inline-flex gap-0.5 rounded-full bg-slate-100 p-1">
        <span aria-hidden className={cn(INDICATOR, '-z-10 rounded-full bg-surface shadow-sm ring-1 ring-black/5')} style={style} />
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
              'h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              on ? 'font-semibold text-fg' : 'text-fg-secondary hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
      </div>
    </div>
  );
}
