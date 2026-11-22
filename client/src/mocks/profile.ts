import { http, HttpResponse } from 'msw';
import type { GradeRef, Me, Profile } from '@/api/types';
import { GRADES, gradeOf, nextGradeOf } from '@/lib/grades';

export const DAILY_READ_CAP = 30;
export const DAILY_COMMENT_CAP = 10;
export const DEFAULT_SCORE_BASE = 1200;

const ledger = {
  base: DEFAULT_SCORE_BASE,
  readPosts: new Set<number>(),
  readDays: new Map<string, number>(),
  readPoints: 0,
  commentDays: new Map<string, number>(),
};

const today = () => new Date().toISOString().slice(0, 10);

export function setScoreBase(score: number) {
  ledger.base = score;
}

export function resetProfile() {
  ledger.base = DEFAULT_SCORE_BASE;
  ledger.readPosts.clear();
  ledger.readDays.clear();
  ledger.readPoints = 0;
  ledger.commentDays.clear();
}

export function scoreRead(postId: number) {
  if (ledger.readPosts.has(postId)) return;
  ledger.readPosts.add(postId);
  const day = today();
  const used = ledger.readDays.get(day) ?? 0;
  if (used >= DAILY_READ_CAP) return;
  ledger.readDays.set(day, used + 1);
  ledger.readPoints += 1;
}

export function claimCommentPoint() {
  const day = today();
  const used = ledger.commentDays.get(day) ?? 0;
  if (used >= DAILY_COMMENT_CAP) return false;
  ledger.commentDays.set(day, used + 1);
  return true;
}

export interface ActivityCounts {
  posts: number;
  scoredPosts: number;
  likes: number;
  comments: number;
  scoredComments: number;
  reads: number;
  bookmarks: number;
}

export function profileScore(c: Pick<ActivityCounts, 'likes' | 'scoredComments'> & Partial<Pick<ActivityCounts, 'scoredPosts'>>) {
  return Math.max(0, ledger.base + ledger.readPoints + c.likes * 2 + c.scoredComments * 5 + (c.scoredPosts ?? 0) * 10);
}

export const gradeRef = (score: number): GradeRef => {
  const g = gradeOf(score);
  return { level: g.level, name: g.name };
};

export const seedAuthorGrade = (authorId: number): GradeRef => {
  const g = GRADES[authorId % GRADES.length];
  return { level: g.level, name: g.name };
};

interface Ctx {
  isMember: (request: Request) => boolean;
  me: () => Me | null;
  error: (status: number, code: string, message: string) => Response;
  counts: () => ActivityCounts;
}

export function profileHandlers({ isMember, me, error, counts }: Ctx) {
  return [
    http.get('*/api/me/profile', ({ request }) => {
      const user = isMember(request) ? me() : null;
      if (!user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const c = counts();
      const score = profileScore(c);
      const g = gradeOf(score);
      const body: Profile = {
        nickname: user.nickname,
        score,
        grade: { level: g.level, name: g.name, minScore: g.minScore, nextMinScore: nextGradeOf(score)?.minScore ?? null },
        stats: { posts: c.posts, likes: c.likes, comments: c.comments, reads: c.reads, bookmarks: c.bookmarks },
      };
      return HttpResponse.json(body);
    }),
  ];
}
