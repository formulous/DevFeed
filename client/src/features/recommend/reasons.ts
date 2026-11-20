import type { Reason } from '@/api/types';

function reasonLabel(reason: Reason) {
  switch (reason.type) {
    case 'INTEREST_TAG':
      return reason.tagName ? `관심 태그 ${reason.tagName} 관련 글이에요` : '관심 태그 관련 글이에요';
    case 'READ_HISTORY':
      return reason.tagName ? `최근 읽은 ${reason.tagName} 글과 비슷해요` : '최근 읽은 글과 비슷해요';
    case 'BOOKMARK':
      return reason.tagName ? `북마크한 ${reason.tagName} 글과 비슷해요` : '북마크한 글과 비슷해요';
    case 'POPULAR':
      return '요즘 많이 읽혀요';
    default:
      return null;
  }
}

export function reasonText(reasons: Reason[]) {
  const labels = reasons.map(reasonLabel).filter((l): l is string => !!l);
  return Array.from(new Set(labels)).join(', ');
}
