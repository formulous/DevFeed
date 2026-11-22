import { Fragment, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useLoginPrompt } from '@/auth/LoginPromptProvider';
import { PATHS } from '@/lib/routes';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { M7_API_READY } from '@/lib/features';
import { CATEGORIES, parseCategory } from '@/lib/community';
import { FIELDS, parseField } from '@/lib/fields';
import { HOVER_MENU_MEDIA, useMediaQuery } from '@/lib/ads';
import { SearchBox } from './AppHeader';

type SectionKey = 'tech' | 'security' | 'community';

interface SubTab {
  to: string;
  label: string;
  memberOnly?: boolean;
  field?: boolean;
  category?: boolean;
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
      { to: PATHS.communityPopular, label: '인기', category: true },
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
  const hoverable = useMediaQuery(HOVER_MENU_MEDIA);

  return (
    <nav
      ref={ref}
      aria-label="피드"
      className={cn(
        'scrollbar-none -mx-4 flex items-center gap-5 overflow-x-auto px-4 py-1 lg:mx-0 lg:px-0',
        hoverable && 'lg:overflow-visible',
        FADE,
      )}
    >
      {SECTIONS.map((section) => {
        const active = current?.key === section.key;
        const cls = cn(
          'shrink-0 whitespace-nowrap py-1 text-[15px] transition-colors duration-150',
          FOCUS,
          active ? 'font-semibold text-fg' : 'font-medium text-fg-secondary hover:text-fg',
        );
        if (!hoverable) {
          return (
            <Link key={section.key} to={section.to} aria-current={active ? 'page' : undefined} className={cls}>
              {section.label}
            </Link>
          );
        }
        return <HoverTab key={section.key} section={section} active={active} className={cls} />;
      })}
    </nav>
  );
}

interface MenuItem {
  key: string;
  label: string;
  to: string;
  active: boolean;
  locked: boolean;
}

function useSectionItems(section: Section, suffix = '') {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { status } = useAuth();
  const query = carry(params, section.keep);
  return section.tabs.map<MenuItem>((tab) => ({
    key: tab.to,
    label: `${tab.label}${suffix}`,
    to: `${tab.to}${query}`,
    active: tab.to === pathname,
    locked: !!tab.memberOnly && status === 'guest',
  }));
}

const MENU_ITEM =
  'flex w-full items-center justify-between gap-4 whitespace-nowrap px-3 py-1.5 text-left text-sm text-fg-secondary hover:bg-hover hover:text-fg focus-visible:bg-hover focus-visible:text-fg focus-visible:outline-none';

function MenuList({
  id,
  label,
  items,
  align = 'left',
  onDone,
  onEscape,
}: {
  id: string;
  label: string;
  items: MenuItem[];
  align?: 'left' | 'right';
  onDone: () => void;
  onEscape: () => void;
}) {
  const { openLoginPrompt } = useLoginPrompt();
  const focusAt = (list: HTMLElement, i: number) => {
    const all = [...list.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    all[(i + all.length) % all.length]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = e.currentTarget;
    const all = [...list.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusAt(list, at + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt(list, at - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(list, 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(list, all.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
    }
  };
  return (
    <div
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'absolute top-full z-40 min-w-[128px] pt-1.5',
        align === 'right' ? 'right-0' : '-left-3',
      )}
    >
      <div className="rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-pop">
        {items.map((item) => {
          const body = (
            <>
              <span className={item.active ? 'font-semibold text-fg' : undefined}>{item.label}</span>
              {item.active && <FiCheck size={14} aria-hidden className="text-fg" />}
            </>
          );
          if (item.locked) {
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={MENU_ITEM}
                onClick={() => {
                  onDone();
                  openLoginPrompt('추천 글을 보려면 로그인이 필요해요');
                }}
              >
                {body}
              </button>
            );
          }
          return (
            <Link
              key={item.key}
              to={item.to}
              role="menuitem"
              tabIndex={-1}
              aria-current={item.active ? 'page' : undefined}
              className={MENU_ITEM}
              onClick={onDone}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const CLOSE_DELAY = 150;

function useDelayedOpen() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => clear, [clear]);
  const show = useCallback(() => {
    clear();
    setOpen(true);
  }, [clear]);
  const hideSoon = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, [clear]);
  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, [clear]);
  return { open, show, hideSoon, hide };
}

function firstItem(container: HTMLElement | null) {
  container?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
}

function HoverTab({ section, active, className }: { section: Section; active: boolean; className: string }) {
  const items = useSectionItems(section);
  const menu = useDelayedOpen();
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLAnchorElement>(null);
  const quiet = useRef(false);
  const { pathname } = useLocation();
  const hide = menu.hide;
  useEffect(() => hide(), [pathname, hide]);

  return (
    <div
      ref={wrap}
      className="relative shrink-0"
      data-testid={`section-menu-${section.key}`}
      onMouseEnter={menu.show}
      onMouseLeave={menu.hideSoon}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) menu.hide();
      }}
    >
      <Link
        ref={trigger}
        to={section.to}
        aria-current={active ? 'page' : undefined}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-controls={menu.open ? id : undefined}
        className={cn(className, 'block')}
        onFocus={() => {
          if (quiet.current) quiet.current = false;
          else menu.show();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            menu.show();
            requestAnimationFrame(() => firstItem(wrap.current));
          } else if (e.key === 'Escape') {
            menu.hide();
          }
        }}
      >
        {section.label}
      </Link>
      {menu.open && (
        <MenuList
          id={id}
          label={`${section.label} 보기`}
          items={items}
          onDone={menu.hide}
          onEscape={() => {
            menu.hide();
            quiet.current = true;
            trigger.current?.focus();
          }}
        />
      )}
    </div>
  );
}

export function SortSelect() {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  if (!section) return null;
  return <SortMenu section={section} />;
}

function SortMenu({ section }: { section: Section }) {
  const items = useSectionItems(section, '순');
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const current = items.find((i) => i.active) ?? items[0];
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div
      ref={wrap}
      className="relative shrink-0"
      data-testid="sort-select"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`정렬: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => firstItem(wrap.current));
          }
        }}
        className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-fg hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        {current.label}
        <FiChevronDown size={14} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <MenuList
          id={id}
          label="정렬"
          items={items}
          align="right"
          onDone={() => setOpen(false)}
          onEscape={() => {
            setOpen(false);
            button.current?.focus();
          }}
        />
      )}
    </div>
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
