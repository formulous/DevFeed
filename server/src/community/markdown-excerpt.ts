export const EXCERPT_MAX = 200;

const RULES: [RegExp, string][] = [
  [/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1[^\n]*$/gm, ' '],
  [/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*$/gm, ' '],
  [/<[^>\n]*>/g, ' '],
  [/!\[([^\]]*)\]\((?:[^()\n]|\([^()\n]*\))*\)/g, '$1'],
  [/\[([^\]]*)\]\((?:[^()\n]|\([^()\n]*\))*\)/g, '$1'],
  [/^\s{0,3}#{1,6}\s+/gm, ''],
  [/^\s{0,3}>\s?/gm, ''],
  [/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, ''],
  [/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, ' '],
  [/^\s*(?:[-*_]\s*){3,}$/gm, ' '],
  [/\|/g, ' '],
  [/`+([^`]*)`+/g, '$1'],
  [/(\*\*|__|~~)(.+?)\1/g, '$2'],
  [/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?=[^\w*]|$)/g, '$1$2'],
];

export function markdownExcerpt(markdown: string, max = EXCERPT_MAX): string {
  let text = markdown.replace(/\r\n?/g, '\n');
  for (const [pattern, replacement] of RULES) text = text.replace(pattern, replacement);
  const plain = text.replace(/\s+/g, ' ').trim();
  const chars = [...plain];
  if (chars.length <= max) return plain;
  return `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}
