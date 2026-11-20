export type FieldKey = 'backend' | 'frontend' | 'ai' | 'data' | 'infra' | 'mobile' | 'security';
export type ApiField = 'BACKEND' | 'FRONTEND' | 'AI' | 'DATA' | 'INFRA' | 'MOBILE' | 'SECURITY';

export interface FieldDef {
  key: FieldKey;
  api: ApiField;
  label: string;
  categories: string[];
}

export const FIELDS: FieldDef[] = [
  { key: 'backend', api: 'BACKEND', label: '백엔드', categories: ['백엔드', '아키텍처'] },
  { key: 'frontend', api: 'FRONTEND', label: '프론트엔드', categories: ['프론트엔드', '디자인'] },
  { key: 'ai', api: 'AI', label: 'AI', categories: ['AI'] },
  { key: 'data', api: 'DATA', label: '데이터', categories: ['데이터', '데이터베이스'] },
  { key: 'infra', api: 'INFRA', label: '인프라', categories: ['인프라', 'DevOps', '클라우드'] },
  { key: 'mobile', api: 'MOBILE', label: '모바일', categories: ['모바일'] },
  { key: 'security', api: 'SECURITY', label: '보안', categories: ['보안'] },
];

export function parseField(value: string | null): FieldDef | null {
  return FIELDS.find((f) => f.key === value) ?? null;
}

export function fieldByApi(value: string | null): FieldDef | null {
  return FIELDS.find((f) => f.api === value) ?? null;
}
