export function duplicateKeyName(error: unknown): string | null {
  const e = error as { code?: string; errno?: number; sqlMessage?: string; driverError?: unknown };
  const source = (e?.driverError as typeof e) ?? e;
  if (source?.code !== 'ER_DUP_ENTRY' && source?.errno !== 1062) return null;
  const match = /for key '(?:[^'.]+\.)?([^']+)'/.exec(source.sqlMessage ?? '');
  return match ? match[1] : '';
}
