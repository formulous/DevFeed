import { Fragment, useEffect, useRef, type RefObject } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useLoginPrompt } from '@/auth/LoginPromptProvider';
import { PATHS } from '@/lib/routes';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { M7_API_READY } from '@/lib/features';
import { FIELDS, parseField } from '@/lib/fields';
import { SearchBox } from './AppHeader';

type SectionKey = 'tech' | 'security';

interface SubTab {
  to: string;
  label: string;
  memberOnly?: boolean;
  field?: boolean;
}

interface Section {
  key: SectionKey;
  to: string;
  label: string;
  keep: string[];
  tabs: SubTab[];
}

const ALL_SECTIONS: Section[] = [
  {
    key: 'tech',
    to: PATHS.tech,
    label: '기술 뉴스',
    keep: ['field'],
    tabs: [
      { to: PATHS.tech, label: '최신', field: true },
      { to: PATHS.techForYou, label: '추천', memberOnly: true },
      { to: PATHS.techPopular, label: '인기', field: true },
    ],
  },
  {
    key: 'security',
    to: PATHS.security,
    label: '보안 뉴스',
    keep: ['region', 'sourceIds'],
    tabs: [
      { to: PATHS.security, label: '최신' },
      { to: PATHS.securityPopular, label: '인기' },
    ],
  },
];

export const SECTIONS = M7_API_READY ? ALL_SECTIONS : ALL_SECTIONS.filter((s) => s.key !== 'security');

export function sectionOf(pathname: string) {
  return SECTIONS.find((s) => s.tabs.some((t) => t.to === pathname)) ?? null;
}

export function heroTitle(pathname: string): string | null {
  if (pathname === '/search') return '검색';
  return sectionOf(pathname)?.label ?? null;
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
  return M7_API_READY && SECTIONS.some((s) => s.tabs.some((t) => t.field && t.to === pathname));
}

export function FeedTabs() {
  const { pathname } = useLocation();
  const ref = useRef<HTMLElement>(null);
  useScrollActiveIntoView(ref, pathname);
  const current = sectionOf(pathname);

  return (
    <nav
      ref={ref}
      aria-label="피드"
      className={cn('scrollbar-none -mx-4 flex items-center gap-5 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-0', FADE)}
    >
      {SECTIONS.map((section) => (
        <Link
          key={section.key}
          to={section.to}
          aria-current={current?.key === section.key ? 'page' : undefined}
          className={cn(
            'shrink-0 whitespace-nowrap py-1 text-[15px] transition-colors duration-150',
            FOCUS,
            current?.key === section.key ? 'font-semibold text-fg' : 'font-medium text-fg-secondary hover:text-fg',
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}

function carry(params: URLSearchParams, keep: string[]) {
  const out = new URLSearchParams();
  for (const key of keep) {
    const v = params.get(key);
    if (v) out.set(key, v);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

const SUB_ITEM =
  'flex h-7 items-center whitespace-nowrap rounded-md px-3.5 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring';

export function SectionTabs() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { status } = useAuth();
  const { openLoginPrompt } = useLoginPrompt();
  const section = sectionOf(pathname);
  if (!section) return null;
  const query = carry(params, section.keep);

  return (
    <nav aria-label={`${section.label} 보기`} data-testid="section-tabs">
      <div className="inline-flex rounded-lg bg-subtle p-0.5">
        {section.tabs.map((tab) => {
          const active = tab.to === pathname;
          const cls = cn(SUB_ITEM, active ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-inset ring-line-strong' : 'font-medium text-fg-secondary hover:text-fg');
          if (tab.memberOnly && status === 'guest') {
            return (
              <button
                key={tab.to}
                type="button"
                className={cls}
                onClick={() => openLoginPrompt('추천 글을 보려면 로그인이 필요해요')}
              >
                {tab.label}
              </button>
            );
          }
          return (
            <Link key={tab.to} to={`${tab.to}${query}`} aria-current={active ? 'page' : undefined} className={cls}>
              {tab.label}
            </Link>
          );
        })}
      </div>
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

  const options = [
    { key: null, label: '전체', name: '전체' },
    ...FIELDS.map((f) => ({ key: f.key as string | null, label: f.label, name: f.name })),
  ];

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
              aria-label={o.name !== o.label ? o.name : undefined}
              title={o.name !== o.label ? o.name : undefined}
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
