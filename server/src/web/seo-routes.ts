export interface SeoRoute {
  pattern: string;
  title: string;
  description: string;
  robots: string;
  canonical: string;
  dynamic?: boolean;
}

export interface SeoRoutes {
  origin: string;
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  routes: SeoRoute[];
  notFound: SeoRoute;
}

export interface RouteMatch {
  route: SeoRoute;
  params: Record<string, string>;
}

function isRoute(value: unknown): value is SeoRoute {
  const r = value as SeoRoute;
  return (
    !!r &&
    typeof r.pattern === 'string' &&
    typeof r.title === 'string' &&
    typeof r.description === 'string' &&
    typeof r.robots === 'string' &&
    typeof r.canonical === 'string'
  );
}

export function parseSeoRoutes(raw: string): SeoRoutes {
  const data = JSON.parse(raw) as SeoRoutes;
  const strings = [data.origin, data.siteName, data.defaultTitle, data.defaultDescription];
  if (strings.some((s) => typeof s !== 'string') || !Array.isArray(data.routes) || !data.routes.every(isRoute) || !isRoute(data.notFound)) {
    throw new Error('routes.json 형식이 올바르지 않음');
  }
  return data;
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

export function normalizePath(path: string): string {
  const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed || '/';
}

export function matchRoute(routes: SeoRoute[], path: string): RouteMatch | null {
  const parts = segments(normalizePath(path));
  for (const route of routes) {
    const pattern = segments(route.pattern);
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = pattern.every((p, i) => {
      if (p.startsWith(':')) {
        params[p.slice(1)] = parts[i];
        return true;
      }
      return p === parts[i];
    });
    if (ok) return { route, params };
  }
  return null;
}

export function fillPattern(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''));
}
