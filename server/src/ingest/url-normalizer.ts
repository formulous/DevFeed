const TRACKING_PARAM_PATTERNS: RegExp[] = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^msclkid$/i,
  /^igshid$/i,
  /^mc_(cid|eid)$/i,
  /^_hs(enc|mi)$/i,
  /^mkt_tok$/i,
];

export const MAX_URL_LENGTH = 2048;

export function normalizePostUrl(raw: string, base?: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  url.hash = '';
  url.username = '';
  url.password = '';
  url.hostname = url.hostname.toLowerCase();

  const kept = [...url.searchParams.entries()].filter(
    ([key]) => !TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key)),
  );
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  }

  let result = url.toString();
  if (url.pathname === '/' && !url.search) result = result.replace(/\/$/, '');
  return result.length <= MAX_URL_LENGTH ? result : null;
}

export function normalizeFeedUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    const result = url.toString();
    return result.length <= MAX_URL_LENGTH ? result : null;
  } catch {
    return null;
  }
}
