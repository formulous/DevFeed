import type { CommunityCategory, PostWriteReason, ReportReason } from '@/api/types';
import { formatDateTime } from './format';

export const CATEGORIES: { key: string; api: CommunityCategory; label: string }[] = [
  { key: 'question', api: 'QUESTION', label: '질문' },
  { key: 'discussion', api: 'DISCUSSION', label: '토론' },
  { key: 'share', api: 'SHARE', label: '공유' },
];

export function parseCategory(value: string | null) {
  return CATEGORIES.find((c) => c.key === value) ?? null;
}

export function categoryOf(api: CommunityCategory) {
  return CATEGORIES.find((c) => c.api === api) ?? CATEGORIES[0];
}

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: '스팸' },
  { value: 'ABUSE', label: '욕설·비방' },
  { value: 'PRIVACY', label: '개인정보 노출' },
  { value: 'OTHER', label: '기타' },
];

export function remainingLabel(availableAt: string | null, now = Date.now()) {
  if (!availableAt) return '';
  const sec = Math.max(1, Math.ceil((Date.parse(availableAt) - now) / 1000));
  if (sec < 60) return `${sec}초`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export function writeBlockedMessage(reason: PostWriteReason | null | undefined, availableAt: string | null | undefined, now = Date.now()) {
  const left = remainingLabel(availableAt ?? null, now);
  if (reason === 'NEW_ACCOUNT') {
    return `가입하고 24시간이 지나면 글을 쓸 수 있어요${availableAt ? ` (${formatDateTime(availableAt)}부터)` : ''}. 댓글은 지금 남길 수 있어요`;
  }
  if (reason === 'DAILY_LIMIT') return `글은 하루 5개까지 쓸 수 있어요. ${left} 뒤에 다시 쓸 수 있어요`;
  if (reason === 'COOLDOWN') return `글은 1분에 하나씩 쓸 수 있어요. ${left} 뒤에 다시 올려 주세요`;
  return '지금은 글을 쓸 수 없어요';
}
