import { escapeHtml, scriptJson } from './html';

export const HEAD_OPEN = '<!--seo:head-->';
export const HEAD_CLOSE = '<!--/seo:head-->';
export const BODY_MARK = '<!--seo:body-->';

export interface HeadInput {
  title: string;
  description: string;
  robots: string;
  canonicalUrl: string | null;
  ogType: 'website' | 'article';
  article?: { publishedTime: string; modifiedTime: string | null; author: string };
  jsonLd?: unknown;
  seoData?: unknown;
}

export function renderHead(h: HeadInput): string {
  const meta = (attr: 'name' | 'property', key: string, content: string) =>
    `<meta ${attr}="${key}" content="${escapeHtml(content)}" data-seo="${key}" />`;
  const lines = [
    `<title data-seo="title">${escapeHtml(h.title)}</title>`,
    meta('name', 'description', h.description),
    meta('name', 'robots', h.robots),
    meta('property', 'og:type', h.ogType),
    meta('property', 'og:title', h.title),
    meta('property', 'og:description', h.description),
    meta('name', 'twitter:title', h.title),
    meta('name', 'twitter:description', h.description),
  ];
  if (h.canonicalUrl) {
    lines.push(`<link rel="canonical" href="${escapeHtml(h.canonicalUrl)}" data-seo="canonical" />`);
    lines.push(meta('property', 'og:url', h.canonicalUrl));
  }
  if (h.article) {
    lines.push(meta('property', 'article:published_time', h.article.publishedTime));
    if (h.article.modifiedTime) lines.push(meta('property', 'article:modified_time', h.article.modifiedTime));
    lines.push(meta('property', 'article:author', h.article.author));
  }
  if (h.jsonLd !== undefined) lines.push(`<script type="application/ld+json" data-seo="jsonld">${scriptJson(h.jsonLd)}</script>`);
  if (h.seoData !== undefined) lines.push(`<script type="application/json" id="seo-data" data-seo="seo-data">${scriptJson(h.seoData)}</script>`);
  return lines.map((l) => `    ${l}`).join('\n');
}

function once(text: string, mark: string): number {
  const at = text.indexOf(mark);
  return at >= 0 && text.indexOf(mark, at + mark.length) < 0 ? at : -1;
}

export function hasMarks(template: string): boolean {
  const open = once(template, HEAD_OPEN);
  const close = once(template, HEAD_CLOSE);
  return open >= 0 && close > open && once(template, BODY_MARK) >= 0;
}

export function inject(template: string, head: string, body: string): string {
  if (!hasMarks(template)) return template;
  const open = template.indexOf(HEAD_OPEN) + HEAD_OPEN.length;
  const close = template.indexOf(HEAD_CLOSE);
  const withHead = `${template.slice(0, open)}\n${head}\n    ${template.slice(close)}`;
  const at = withHead.indexOf(BODY_MARK);
  return `${withHead.slice(0, at)}${body}${withHead.slice(at + BODY_MARK.length)}`;
}
