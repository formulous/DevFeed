import { kstDayStart } from '../score/score-policy';

export const POST_LIMIT = { accountAgeMs: 24 * 60 * 60 * 1000, perDay: 5, gapMs: 60 * 1000 } as const;

export type PostWriteReason = 'NEW_ACCOUNT' | 'DAILY_LIMIT' | 'COOLDOWN';

export interface WriteLimitInput {
  isAdmin: boolean;
  newAccountLimit: boolean;
  accountCreatedAt: Date;
  todayCount: number;
  lastWrittenAt: Date | null;
  now: Date;
}

export interface PostWriteStatus {
  allowed: boolean;
  reason: PostWriteReason | null;
  availableAt: Date | null;
  retryAfterSec: number | null;
  remainingToday: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function postWriteStatus(input: WriteLimitInput): PostWriteStatus {
  if (input.isAdmin) return { allowed: true, reason: null, availableAt: null, retryAfterSec: null, remainingToday: null };
  const now = input.now.getTime();
  const remainingToday = Math.max(0, POST_LIMIT.perDay - input.todayCount);
  const blocks: [PostWriteReason, number][] = [];
  const grown = input.accountCreatedAt.getTime() + POST_LIMIT.accountAgeMs;
  if (input.newAccountLimit && grown > now) blocks.push(['NEW_ACCOUNT', grown]);
  if (remainingToday === 0) blocks.push(['DAILY_LIMIT', kstDayStart(input.now).getTime() + DAY_MS]);
  if (input.lastWrittenAt) {
    const cooled = input.lastWrittenAt.getTime() + POST_LIMIT.gapMs;
    if (cooled > now) blocks.push(['COOLDOWN', cooled]);
  }
  if (!blocks.length) return { allowed: true, reason: null, availableAt: null, retryAfterSec: null, remainingToday };
  const [reason, at] = blocks.reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    allowed: false,
    reason,
    availableAt: new Date(at),
    retryAfterSec: Math.max(1, Math.ceil((at - now) / 1000)),
    remainingToday,
  };
}
