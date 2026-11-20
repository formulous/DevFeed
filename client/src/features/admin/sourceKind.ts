import type { AdminSourceListItem, NewsRegion, SourceKind, SourceType } from '@/api/types';

export const KIND_LABEL: Record<SourceKind, string> = { BLOG: '기술 블로그', SECURITY_NEWS: '보안 뉴스' };
export const REGION_LABEL: Record<NewsRegion, string> = { DOMESTIC: '국내', OVERSEAS: '해외' };
export const TYPE_LABEL: Record<SourceType, string> = { COMPANY: '기업', PERSONAL: '개인' };

export function sourceKindLabel(s: Pick<AdminSourceListItem, 'kind' | 'region' | 'type'>) {
  if (s.kind === 'SECURITY_NEWS') return `${KIND_LABEL.SECURITY_NEWS} · ${s.region ? REGION_LABEL[s.region] : '-'}`;
  return `${KIND_LABEL.BLOG} · ${TYPE_LABEL[s.type]}`;
}

export function parseKind(value: string | null): SourceKind | null {
  return value === 'BLOG' || value === 'SECURITY_NEWS' ? value : null;
}
