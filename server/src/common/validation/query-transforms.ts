export function toIdList({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const ids = parts.map((p) => p.trim()).filter(Boolean).map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  return [...new Set(ids)];
}

export function toInt({ value }: { value: unknown }): unknown {
  if (value === undefined || value === '') return undefined;
  return /^-?\d+$/.test(String(value)) ? Number(value) : NaN;
}
