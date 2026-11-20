import { decode } from 'html-entities';

export const SUMMARY_MAX_LENGTH = 300;
export const NEWS_SUMMARY_MAX_LENGTH = 150;
export const TITLE_MAX_LENGTH = 500;
const ELLIPSIS = '…';

export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|iframe|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, ' ');
  return decode(withoutTags)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateChars(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max - 1).join('');
  const atBoundary = /\s$/.test(cut) || /^\s/.test(chars[max - 1] ?? '');
  const trimmed = atBoundary ? cut.trimEnd() : cut.replace(/\S+$/, '').trimEnd() || cut;
  return trimmed + ELLIPSIS;
}

export function makeSummary(...candidates: (string | null | undefined)[]): string | null {
  return makeSummaryWithin(SUMMARY_MAX_LENGTH, ...candidates);
}

export function makeSummaryWithin(max: number, ...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    const text = htmlToText(candidate);
    if (text) return truncateChars(text, max);
  }
  return null;
}

export function makeTitle(raw: string | null | undefined): string | null {
  const text = htmlToText(raw);
  return text ? truncateChars(text, TITLE_MAX_LENGTH) : null;
}
