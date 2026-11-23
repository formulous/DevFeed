import { xmlText } from './xml';

export const SITEMAP_MAX_URLS = 50_000;
export const SITEMAP_STATIC_PATHS = ['/tech', '/security', '/community', '/privacy'];

export interface SitemapEntry {
  loc: string;
  lastmod?: Date;
}

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

export function urlset(entries: SitemapEntry[]): string {
  const urls = entries.map(
    (e) => `  <url><loc>${xmlText(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}</url>`,
  );
  return `${HEADER}<urlset ${NS}>\n${urls.join('\n')}\n</urlset>\n`;
}

export function sitemapIndex(locs: string[]): string {
  const items = locs.map((loc) => `  <sitemap><loc>${xmlText(loc)}</loc></sitemap>`);
  return `${HEADER}<sitemapindex ${NS}>\n${items.join('\n')}\n</sitemapindex>\n`;
}

export interface SitemapPage {
  postOffset: number;
  postLimit: number;
  includeStatic: boolean;
}

export function sitemapPageCount(postCount: number, max = SITEMAP_MAX_URLS): number {
  return Math.max(1, Math.ceil((postCount + SITEMAP_STATIC_PATHS.length) / max));
}

export function sitemapPage(page: number, max = SITEMAP_MAX_URLS): SitemapPage {
  const first = max - SITEMAP_STATIC_PATHS.length;
  if (page === 1) return { postOffset: 0, postLimit: first, includeStatic: true };
  return { postOffset: first + (page - 2) * max, postLimit: max, includeStatic: false };
}
