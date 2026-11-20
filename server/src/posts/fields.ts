export const FIELDS = ['BACKEND', 'FRONTEND', 'AI', 'DATA', 'INFRA', 'MOBILE', 'SECURITY'] as const;

export type Field = (typeof FIELDS)[number];

export const FIELD_CATEGORIES: Record<Field, readonly string[]> = {
  BACKEND: ['Backend', 'Architecture', '백엔드', '아키텍처'],
  FRONTEND: ['Frontend', 'Design', '프론트엔드', '디자인'],
  AI: ['AI'],
  DATA: ['Data', 'Database', '데이터', '데이터베이스'],
  INFRA: ['Infra', 'DevOps', 'Cloud', '인프라', '클라우드'],
  MOBILE: ['Mobile', '모바일'],
  SECURITY: ['Security', '보안'],
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
