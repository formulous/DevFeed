import { M7_API_READY } from './features';

export type FieldKey = 'backend' | 'frontend' | 'ai' | 'data' | 'infra' | 'mobile' | 'security';
export type ApiField = 'BACKEND' | 'FRONTEND' | 'AI' | 'DATA' | 'INFRA' | 'MOBILE' | 'SECURITY';

export interface FieldDef {
  key: FieldKey;
  api: ApiField;
  label: string;
  name: string;
  categories: string[];
}

export const FIELDS: FieldDef[] = [
  { key: 'backend', api: 'BACKEND', label: 'BE', name: 'Backend', categories: ['Backend', 'Architecture'] },
  { key: 'frontend', api: 'FRONTEND', label: 'FE', name: 'Frontend', categories: ['Frontend', 'Design'] },
  { key: 'ai', api: 'AI', label: 'AI', name: 'AI', categories: ['AI'] },
  { key: 'data', api: 'DATA', label: 'Data', name: 'Data', categories: ['Data', 'Database'] },
  { key: 'infra', api: 'INFRA', label: 'Infra', name: 'Infra', categories: ['Infra', 'DevOps', 'Cloud'] },
  { key: 'mobile', api: 'MOBILE', label: 'Mobile', name: 'Mobile', categories: ['Mobile'] },
  { key: 'security', api: 'SECURITY', label: 'Security', name: 'Security', categories: ['Security'] },
];

export function parseField(value: string | null): FieldDef | null {
  if (!M7_API_READY) return null;
  return FIELDS.find((f) => f.key === value) ?? null;
}

export function fieldByApi(value: string | null): FieldDef | null {
  return FIELDS.find((f) => f.api === value) ?? null;
}
