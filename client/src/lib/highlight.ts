export interface HighlightSegment {
  text: string;
  match: boolean;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function splitHighlight(text: string, query: string): HighlightSegment[] {
  const terms = Array.from(new Set(query.trim().split(/\s+/).filter(Boolean))).sort(
    (a, b) => b.length - a.length,
  );
  if (terms.length === 0 || text === '') return [{ text, match: false }];

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return text
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: terms.some((t) => t.toLowerCase() === part.toLowerCase()) }));
}
