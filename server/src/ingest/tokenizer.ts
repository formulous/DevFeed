const CJK = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SEPARATOR = /[^\p{L}\p{N}]+/u;

function bigrams(word: string): string[] {
  const chars = Array.from(word);
  if (chars.length < 2) return [];
  const result: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) result.push(chars[i] + chars[i + 1]);
  return result;
}

export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  const words = text.normalize('NFKC').toLowerCase().split(SEPARATOR);
  const tokens: string[] = [];
  for (const word of words) {
    if (!word) continue;
    if (CJK.test(word)) tokens.push(...bigrams(word));
    else if (Array.from(word).length >= 2) tokens.push(word);
  }
  return tokens;
}

export function toTokenString(...texts: (string | null | undefined)[]): string {
  return texts.flatMap((text) => tokenize(text)).join(' ');
}

export function buildBooleanQuery(query: string): string {
  const unique = [...new Set(tokenize(query))];
  return unique.map((token) => `+${token}`).join(' ');
}
