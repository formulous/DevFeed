export const AVATAR_TONES = [
  { bg: '#e4e4e7', fg: '#27272a' },
  { bg: '#c4c4ca', fg: '#18181b' },
  { bg: '#a1a1aa', fg: '#18181b' },
  { bg: '#71717a', fg: '#ffffff' },
  { bg: '#52525b', fg: '#ffffff' },
  { bg: '#3f3f46', fg: '#ffffff' },
] as const;

export function avatarInitial(nickname: string) {
  const first = [...nickname.trim()][0] ?? '?';
  return first.toLocaleUpperCase('en-US');
}

export function avatarTone(nickname: string) {
  let hash = 0;
  for (const ch of nickname) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
