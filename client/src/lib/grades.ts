export interface Grade {
  level: number;
  name: string;
  minScore: number;
}

export const GRADES: Grade[] = [
  { level: 1, name: 'Hello World', minScore: 0 },
  { level: 2, name: 'Junior Dev', minScore: 100 },
  { level: 3, name: 'Senior Dev', minScore: 500 },
  { level: 4, name: 'Tech Lead', minScore: 2000 },
  { level: 5, name: 'Architect', minScore: 5000 },
];

export const SCORE_RULES = [
  { activity: '글 읽기', point: '+1', limit: '같은 글은 처음 한 번만, 하루 최대 30점' },
  { activity: '좋아요', point: '+2', limit: '같은 글은 한 번만, 취소하면 회수돼요' },
  { activity: '댓글·답글', point: '+5', limit: '하루 최대 10개분, 삭제되거나 숨겨지면 회수돼요' },
  { activity: '북마크', point: '0', limit: '점수에는 들어가지 않아요' },
];

export function gradeOf(score: number): Grade {
  return [...GRADES].reverse().find((g) => score >= g.minScore) ?? GRADES[0];
}

export function nextGradeOf(score: number): Grade | null {
  return GRADES.find((g) => g.minScore > score) ?? null;
}

export function gradeByLevel(level: number) {
  return GRADES.find((g) => g.level === level) ?? null;
}

export function gradeProgress(score: number, minScore: number, nextMinScore: number | null) {
  if (nextMinScore === null) return 1;
  const span = nextMinScore - minScore;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (score - minScore) / span));
}
