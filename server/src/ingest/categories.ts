export const FEED_CATEGORIES_MAX = 500;
const SEPARATOR = '\n';

export function joinCategories(categories: string[], max = FEED_CATEGORIES_MAX): string | null {
  let result = '';
  for (const raw of categories) {
    const category = raw.replace(/\s+/g, ' ').trim();
    if (!category) continue;
    const next = result ? `${result}${SEPARATOR}${category}` : category;
    if (Array.from(next).length > max) break;
    result = next;
  }
  return result || null;
}

export function splitCategories(stored: string | null | undefined): string[] {
  return stored ? stored.split(SEPARATOR).filter(Boolean) : [];
}
