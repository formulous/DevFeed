import { useEffect, useRef, useSyncExternalStore } from 'react';
import { matchPath, useLocation } from 'react-router';
import { NOT_FOUND_ROUTE, ROBOTS_INDEX, ROBOTS_NOINDEX, SEO_ROUTES, SITE_NAME, SITE_ORIGIN, type SeoRoute } from '@/lib/seoRoutes';

export interface SeoOverride {
  title?: string;
  description?: string;
  robots?: string;
  ogType?: 'website' | 'article';
}

const MANAGED = ['title', 'description', 'canonical', 'robots', 'og:type', 'og:title', 'og:description', 'og:url', 'twitter:title', 'twitter:description'];

let override: { path: string; value: SeoOverride } | null = null;
const listeners = new Set<() => void>();

export function setSeoOverride(path: string, value: SeoOverride | null) {
  const cur = override;
  if (!value) {
    if (!cur || cur.path !== path) return;
    override = null;
  } else {
    override = { path, value };
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getOverride = () => override;

export function useSeoOverride(value: SeoOverride | null) {
  const { pathname } = useLocation();
  const key = value ? JSON.stringify(value) : '';
  useEffect(() => {
    if (!key) return;
    setSeoOverride(pathname, JSON.parse(key) as SeoOverride);
    return () => setSeoOverride(pathname, null);
  }, [pathname, key]);
}

export function routeFor(pathname: string): SeoRoute {
  return SEO_ROUTES.find((r) => matchPath(r.pattern, pathname)) ?? NOT_FOUND_ROUTE;
}

export function titleFor(pathname: string, search: string) {
  if (matchPath('/search', pathname)) {
    const q = new URLSearchParams(search).get('q')?.trim();
    return q ? `검색: ${q} · ${SITE_NAME}` : `검색 · ${SITE_NAME}`;
  }
  return routeFor(pathname).title;
}

export function robotsFor(pathname: string) {
  return routeFor(pathname).robots;
}

export function isNoindex(pathname: string) {
  return robotsFor(pathname) !== ROBOTS_INDEX;
}

export function canonicalFor(pathname: string) {
  const route = routeFor(pathname);
  if (route === NOT_FOUND_ROUTE) return '';
  if (route.canonical === route.pattern) return `${SITE_ORIGIN}${pathname.replace(/\/+$/, '') || '/'}`;
  return `${SITE_ORIGIN}${route.canonical}`;
}

function upsert(key: string, create: () => HTMLElement, set: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(`[data-seo="${key}"]`);
  if (!el) {
    el = create();
    el.setAttribute('data-seo', key);
    document.head.appendChild(el);
  }
  set(el);
}

function meta(key: string, attr: 'name' | 'property', name: string, content: string) {
  upsert(
    key,
    () => {
      const m = document.createElement('meta');
      m.setAttribute(attr, name);
      return m;
    },
    (el) => el.setAttribute('content', content),
  );
}

interface HeadValues {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogType: string;
}

function applyHead(v: HeadValues) {
  upsert(
    'title',
    () => document.head.querySelector('title') ?? document.createElement('title'),
    (el) => {
      el.textContent = v.title;
    },
  );
  document.title = v.title;
  meta('description', 'name', 'description', v.description);
  meta('robots', 'name', 'robots', v.robots);
  meta('og:type', 'property', 'og:type', v.ogType);
  meta('og:title', 'property', 'og:title', v.title);
  meta('og:description', 'property', 'og:description', v.description);
  meta('twitter:title', 'name', 'twitter:title', v.title);
  meta('twitter:description', 'name', 'twitter:description', v.description);
  if (v.canonical) {
    meta('og:url', 'property', 'og:url', v.canonical);
    upsert(
      'canonical',
      () => {
        const l = document.createElement('link');
        l.rel = 'canonical';
        return l;
      },
      (el) => el.setAttribute('href', v.canonical),
    );
  } else {
    document.head.querySelectorAll('[data-seo="canonical"], [data-seo="og:url"]').forEach((el) => el.remove());
  }
}

function dropForeign() {
  document.head.querySelectorAll<HTMLElement>('[data-seo]').forEach((el) => {
    if (!MANAGED.includes(el.dataset.seo ?? '')) el.remove();
  });
}

export function RouteTitle() {
  const { pathname, search } = useLocation();
  const current = useSyncExternalStore(subscribe, getOverride, getOverride);
  const firstPath = useRef(pathname);
  const left = useRef(false);

  useEffect(() => {
    const route = routeFor(pathname);
    const own = current && current.path === pathname ? current.value : null;
    if (pathname !== firstPath.current) left.current = true;
    if (left.current) dropForeign();
    if (route.dynamic && !own && !left.current) return;
    applyHead({
      title: own?.title ?? titleFor(pathname, search),
      description: own?.description ?? route.description,
      canonical: canonicalFor(pathname),
      robots: own?.robots ?? (route === NOT_FOUND_ROUTE ? ROBOTS_NOINDEX : route.robots),
      ogType: own?.ogType ?? 'website',
    });
  }, [pathname, search, current]);

  return null;
}
