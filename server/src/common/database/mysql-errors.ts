export function duplicateKeyName(error: unknown): string | null {
  const e = error as { code?: string; errno?: number; sqlMessage?: string; driverError?: unknown };
  const source = (e?.driverError as typeof e) ?? e;
  if (source?.code !== 'ER_DUP_ENTRY' && source?.errno !== 1062) return null;
  const match = /for key '(?:[^'.]+\.)?([^']+)'/.exec(source.sqlMessage ?? '');
  return match ? match[1] : '';
}

export function isMissingReference(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; driverError?: { code?: string; errno?: number } };
  const source = e?.driverError ?? e;
  return source?.code === 'ER_NO_REFERENCED_ROW_2' || source?.errno === 1452;
}
