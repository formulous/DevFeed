export const SCORE = {
  read: 1,
  readDailyCap: 30,
  like: 2,
  comment: 5,
  commentDailyCount: 10,
  postWrite: 10,
  postWriteDailyCount: 3,
  likeReceived: 1,
  likeReceivedDailyCap: 50,
} as const;

export const GRADES = [
  { level: 1, name: 'Hello World', minScore: 0 },
  { level: 2, name: 'Junior Dev', minScore: 100 },
  { level: 3, name: 'Senior Dev', minScore: 500 },
  { level: 4, name: 'Tech Lead', minScore: 2000 },
  { level: 5, name: 'Architect', minScore: 5000 },
] as const;

export interface Grade {
  level: number;
  name: string;
}

export interface ProfileGrade extends Grade {
  minScore: number;
  nextMinScore: number | null;
}

export function gradeOf(score: number): ProfileGrade {
  let index = 0;
  while (index + 1 < GRADES.length && score >= GRADES[index + 1].minScore) index++;
  const current = GRADES[index];
  const next = GRADES[index + 1];
  return { level: current.level, name: current.name, minScore: current.minScore, nextMinScore: next ? next.minScore : null };
}

export function gradeBrief(score: number): Grade {
  const { level, name } = gradeOf(score);
  return { level, name };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function kstDayStart(now: Date): Date {
  const shifted = now.getTime() + KST_OFFSET_MS;
  return new Date(shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS) - KST_OFFSET_MS);
}
