import type { Reason } from '@/api/types';

function reasonLabel(reason: Reason) {
  switch (reason.type) {
    case 'INTEREST_TAG':
      return reason.tagName ? `${reason.tagName} 관심 태그` : '관심 태그';
    case 'READ_HISTORY':
      return reason.tagName ? `최근 읽은 ${reason.tagName} 글과 비슷함` : '최근 읽은 글과 비슷함';
    case 'BOOKMARK':
      return reason.tagName ? `북마크한 ${reason.tagName} 글과 비슷함` : '북마크한 글과 비슷함';
    case 'POPULAR':
      return '요즘 많이 읽힘';
    default:
      return null;
  }
}

export function reasonText(reasons: Reason[]) {
  const labels = reasons.map(reasonLabel).filter((l): l is string => !!l);
  return Array.from(new Set(labels)).join(', ');
}
