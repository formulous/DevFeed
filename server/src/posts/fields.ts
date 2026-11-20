export const FIELDS = ['BACKEND', 'FRONTEND', 'AI', 'DATA', 'INFRA', 'MOBILE', 'SECURITY'] as const;

export type Field = (typeof FIELDS)[number];

export const FIELD_CATEGORIES: Record<Field, readonly string[]> = {
  BACKEND: ['Backend', 'Architecture'],
  FRONTEND: ['Frontend', 'Design'],
  AI: ['AI'],
  DATA: ['Data', 'Database'],
  INFRA: ['Infra', 'DevOps', 'Cloud'],
  MOBILE: ['Mobile'],
  SECURITY: ['Security'],
};

export function groupTagsByField(tags: { id: number; category: string | null }[]): Map<Field, number[]> {
  const result = new Map<Field, number[]>(FIELDS.map((field) => [field, []]));
  for (const field of FIELDS) {
    const categories = new Set(FIELD_CATEGORIES[field]);
    for (const tag of tags) if (tag.category && categories.has(tag.category)) result.get(field)!.push(tag.id);
    result.get(field)!.sort((a, b) => a - b);
  }
  return result;
}
