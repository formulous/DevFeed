import { GRADES, gradeBrief, gradeOf, kstDayStart, SCORE } from './score-policy';

describe('등급 표 (F-083 spec 값 고정)', () => {
  it('spec 표와 같음', () => {
    expect(GRADES.map((g) => [g.level, g.name, g.minScore])).toEqual([
      [1, 'Hello World', 0],
      [2, 'Junior Dev', 100],
      [3, 'Senior Dev', 500],
      [4, 'Tech Lead', 2000],
      [5, 'Architect', 5000],
    ]);
    expect(SCORE).toEqual({
      read: 1,
      readDailyCap: 30,
      like: 2,
      comment: 5,
      commentDailyCount: 10,
      postWrite: 10,
      postWriteDailyCount: 3,
      likeReceived: 1,
      likeReceivedDailyCap: 50,
    });
  });

  it.each([
    [0, 1, 0, 100],
    [99, 1, 0, 100],
    [100, 2, 100, 500],
    [499, 2, 100, 500],
    [500, 3, 500, 2000],
    [1999, 3, 500, 2000],
    [2000, 4, 2000, 5000],
    [4999, 4, 2000, 5000],
    [5000, 5, 5000, null],
    [123456, 5, 5000, null],
  ])('점수 %i → Lv.%i (기준 %i, 다음 %s)', (score, level, minScore, nextMinScore) => {
    expect(gradeOf(score)).toMatchObject({ level, minScore, nextMinScore });
  });

  it('gradeBrief는 레벨·이름만', () => {
    expect(gradeBrief(1240)).toEqual({ level: 3, name: 'Senior Dev' });
  });
});

describe('kstDayStart', () => {
  it('KST 자정을 UTC로 반환', () => {
    expect(kstDayStart(new Date('2026-11-22T14:59:59.999Z')).toISOString()).toBe('2026-11-21T15:00:00.000Z');
    expect(kstDayStart(new Date('2026-11-22T15:00:00.000Z')).toISOString()).toBe('2026-11-22T15:00:00.000Z');
    expect(kstDayStart(new Date('2026-11-22T00:00:00.000Z')).toISOString()).toBe('2026-11-21T15:00:00.000Z');
  });
});
