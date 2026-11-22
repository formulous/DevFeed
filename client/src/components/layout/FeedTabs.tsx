import { Fragment, useEffect, useRef, type RefObject } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useLoginPrompt } from '@/auth/LoginPromptProvider';
import { PATHS } from '@/lib/routes';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { M7_API_READY } from '@/lib/features';
import { CATEGORIES, parseCategory } from '@/lib/community';
import { FIELDS, parseField } from '@/lib/fields';
import { parseScope } from '@/lib/searchScope';
import { SearchBox } from './AppHeader';

type SectionKey = 'tech' | 'security' | 'community';

interface SubTab {
  to: string;
  label: string;
  memberOnly?: boolean;
  field?: boolean;
  category?: boolean;
  ranked?: boolean;
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
    key: 'community',
    to: PATHS.community,
    label: '자유 게시판',
    keep: ['category'],
    tabs: [
      { to: PATHS.community, label: '최신', category: true },
      { to: PATHS.communityPopular, label: '인기', category: true, ranked: true },
      { to: PATHS.communityComments, label: '댓글', category: true, ranked: true },
      { to: PATHS.communityLikes, label: '좋아요', category: true, ranked: true },
    ],
  },
  {
    key: 'tech',
    to: PATHS.tech,
    label: '기술 뉴스',
    keep: ['field'],
    tabs: [
      { to: PATHS.tech, label: '최신', field: true },
      { to: PATHS.techForYou, label: '추천', memberOnly: true },
      { to: PATHS.techPopular, label: '인기', field: true, ranked: true },
      { to: PATHS.techComments, label: '댓글', field: true, ranked: true },
    ],
  },
  {
    key: 'security',
    to: PATHS.security,
    label: '보안 뉴스',
    keep: ['region', 'sourceIds'],
    tabs: [
      { to: PATHS.security, label: '최신' },
      { to: PATHS.securityPopular, label: '인기', ranked: true },
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
  const [params] = useSearchParams();
  useScrollActiveIntoView(ref, pathname);
  const searchScope = pathname === '/search' ? parseScope(params.get('scope')) : null;
  const current = searchScope ? SECTIONS.find((s) => s.key === searchScope) : sectionOf(pathname);

  return (
    <nav
      ref={ref}
      aria-label="피드"
      className={cn('scrollbar-none -mx-4 flex items-center gap-5 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-0', FADE)}
    >
      {SECTIONS.map((section) => {
        const active = current?.key === section.key;
        return (
          <Link
            key={section.key}
            to={section.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 whitespace-nowrap py-1 text-[15px] transition-colors duration-150',
              FOCUS,
              active ? 'font-semibold text-fg' : 'font-medium text-fg-secondary hover:text-fg',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

interface SortItem {
  key: string;
  label: string;
  to: string;
  active: boolean;
  locked: boolean;
}

function useSortItems(section: Section) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { status } = useAuth();
  return section.tabs.map<SortItem>((tab) => ({
    key: tab.to,
    label: `${tab.label}순`,
    to: tabHref(tab, section, params),
    active: tab.to === pathname,
    locked: !!tab.memberOnly && status === 'guest',
  }));
}

export function SortTabs() {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  if (!section) return null;
  return <SortTabList section={section} />;
}

function SortTabList({ section }: { section: Section }) {
  const items = useSortItems(section);
  const { openLoginPrompt } = useLoginPrompt();
  return (
    <nav aria-label="정렬" data-testid="sort-tabs" className="flex shrink-0 items-center gap-2">
      {items.map((item, i) => {
        const cls = cn(
          'shrink-0 whitespace-nowrap py-0.5 text-[13px] transition-colors duration-150',
          FOCUS,
          item.active ? 'font-semibold text-fg' : 'text-fg-secondary hover:text-fg',
        );
        return (
          <Fragment key={item.key}>
            {i > 0 && (
              <span aria-hidden className="shrink-0 select-none text-[13px] text-fg-muted">
                ·
              </span>
            )}
            {item.locked ? (
              <button type="button" className={cls} onClick={() => openLoginPrompt('추천 글을 보려면 로그인이 필요해요')}>
                {item.label}
              </button>
            ) : (
              <Link to={item.to} aria-current={item.active ? 'page' : undefined} className={cls}>
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
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

function tabHref(tab: SubTab, section: Section, params: URLSearchParams) {
  return `${tab.to}${carry(params, tab.ranked ? [...section.keep, 'period'] : section.keep)}`;
}

const SUB_ITEM =
  'flex h-7 items-center whitespace-nowrap rounded-md px-3.5 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring';

export function SectionTabs() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { status } = useAuth();
  const { openLoginPrompt } = useLoginPrompt();
  const ref = useRef<HTMLElement>(null);
  const section = sectionOf(pathname);
  useScrollActiveIntoView(ref, pathname);
  if (!section) return null;

  return (
    <nav
      ref={ref}
      aria-label={`${section.label} 보기`}
      data-testid="section-tabs"
      className={cn('scrollbar-none -ml-4 min-w-0 overflow-x-auto pl-4 lg:ml-0 lg:pl-0', FADE)}
    >
      <div className="inline-flex rounded-lg bg-subtle p-0.5">
        {section.tabs.map((tab) => {
          const active = tab.to === pathname;
          const cls = cn(SUB_ITEM, active ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-inset ring-line-strong' : 'font-medium text-fg-secondary hover:text-fg');
          if (tab.memberOnly && status === 'guest') {
            return (
              <button
                key={tab.to}
                type="button"
                className={cn(cls, 'shrink-0')}
                onClick={() => openLoginPrompt('추천 글을 보려면 로그인이 필요해요')}
              >
                {tab.label}
              </button>
            );
          }
          return (
            <Link key={tab.to} to={tabHref(tab, section, params)} aria-current={active ? 'page' : undefined} className={cn(cls, 'shrink-0')}>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function isCategoryTab(pathname: string) {
  return SECTIONS.some((s) => s.tabs.some((t) => t.category && t.to === pathname));
}

interface TextOption {
  key: string | null;
  label: string;
  name: string;
}

function useParamSelect(param: string) {
  const [params, setParams] = useSearchParams();
  const select = (key: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key) next.set(param, key);
        else next.delete(param);
        return next;
      },
      { replace: true },
    );
  return [params, select] as const;
}

export function FieldTabs() {
  const { pathname } = useLocation();
  const [params, select] = useParamSelect('field');
  const current = parseField(params.get('field'))?.key ?? null;
  if (!isFieldTab(pathname)) return null;
  const options = [
    { key: null, label: '전체', name: '전체' },
    ...FIELDS.map((f) => ({ key: f.key as string | null, label: f.label, name: f.name })),
  ];
  return <TextTabs label="분야" options={options} current={current} onSelect={select} dep={pathname} />;
}

export function CategoryTabs() {
  const { pathname } = useLocation();
  const [params, select] = useParamSelect('category');
  const current = parseCategory(params.get('category'))?.key ?? null;
  if (!isCategoryTab(pathname)) return null;
  const options = [
    { key: null, label: '전체', name: '전체' },
    ...CATEGORIES.map((c) => ({ key: c.key as string | null, label: c.label, name: c.label })),
  ];
  return <TextTabs label="말머리" options={options} current={current} onSelect={select} dep={pathname} />;
}

function TextTabs({
  label,
  options,
  current,
  onSelect,
  dep,
}: {
  label: string;
  options: TextOption[];
  current: string | null;
  onSelect: (key: string | null) => void;
  dep: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollActiveIntoView(ref, `${dep}:${current ?? ''}`);
  const select = onSelect;

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className={cn('scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-0', FADE)}
    >
      {options.map((o, i) => {
        const on = current === o.key;
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
