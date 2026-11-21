const DEVICES: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/CrOS/, 'Chromebook'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
];

const BROWSERS: [RegExp, string][] = [
  [/EdgiOS|EdgA|Edg\//, 'Edge'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Whale/, 'Whale'],
  [/OPR\/|OPiOS/, 'Opera'],
  [/FxiOS|Firefox\//, 'Firefox'],
  [/CriOS|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

function match(table: [RegExp, string][], ua: string): string | null {
  return table.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
}

export function nameFromUserAgent(ua: string | undefined): string | null {
  if (!ua) return null;
  const device = match(DEVICES, ua);
  const browser = match(BROWSERS, ua);
  if (!device || !browser) return null;
  return `${device} ${browser}`;
}

export function defaultPasskeyName(ua: string | undefined, existingCount: number): string {
  return nameFromUserAgent(ua) ?? `패스키 ${existingCount + 1}`;
}
