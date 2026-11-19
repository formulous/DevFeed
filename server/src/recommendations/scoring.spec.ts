import {
  coldItems,
  computePreferences,
  decay,
  diversify,
  fillToMinimum,
  reasonLabel,
  scoreCandidates,
  toReasons,
  topPreferredTags,
} from './scoring';

const now = new Date('2026-11-19T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('decay', () => {
  it('반감기 7일', () => {
    expect(decay(now, now)).toBe(1);
    expect(decay(daysAgo(7), now)).toBeCloseTo(0.5);
    expect(decay(daysAgo(14), now)).toBeCloseTo(0.25);
  });
});

describe('computePreferences', () => {
  it('관심 3, 북마크 2×감쇠, 읽기 1×감쇠를 합산하고 최댓값으로 정규화', () => {
    const prefs = computePreferences(
      [
        { kind: 'INTEREST', tagId: 1 },
        { kind: 'INTEREST', tagId: 1 },
        { kind: 'BOOKMARK', tagId: 2, at: now },
        { kind: 'READ', tagId: 2, at: daysAgo(7) },
        { kind: 'READ', tagId: 3, at: now },
      ],
      now,
    );
    expect(prefs.get(1)!.score).toBeCloseTo(1);
    expect(prefs.get(2)!.score).toBeCloseTo(2.5 / 3);
    expect(prefs.get(3)!.score).toBeCloseTo(1 / 3);
    expect(prefs.get(2)!.byKind).toEqual({ INTEREST: 0, BOOKMARK: 2, READ: 0.5 });
    expect(topPreferredTags(prefs, 2)).toEqual([1, 2]);
  });

  it('신호가 없으면 빈 선호도', () => {
    expect(computePreferences([], now).size).toBe(0);
  });
});

describe('scoreCandidates', () => {
  const prefs = computePreferences(
    [
      { kind: 'INTEREST', tagId: 1 },
      { kind: 'READ', tagId: 2, at: now },
    ],
    now,
  );

  it('태그 0.7 + 인기 0.2 + 최신 0.1, 선호 태그 없는 후보 제외', () => {
    const ranked = scoreCandidates(
      [
        { postId: 10, sourceId: 1, viewCount: 0, publishedAt: daysAgo(7), tagIds: [1] },
        { postId: 11, sourceId: 1, viewCount: 99, publishedAt: now, tagIds: [2] },
        { postId: 12, sourceId: 1, viewCount: 99, publishedAt: now, tagIds: [9] },
      ],
      prefs,
      now,
    );
    expect(ranked.map((r) => r.postId)).toEqual([10, 11]);
    expect(ranked[0].score).toBeCloseTo(0.7 + 0 + 0.05);
    expect(ranked[1].score).toBeCloseTo(0.7 / 3 + 0.2 + 0.1);
  });

  it('이유는 선호도 높은 태그 2개, 근거별 지배 요인', () => {
    const [item] = scoreCandidates(
      [{ postId: 1, sourceId: 1, viewCount: 0, publishedAt: now, tagIds: [2, 1, 9] }],
      prefs,
      now,
    );
    expect(item.reasonTags).toEqual([
      { tagId: 1, type: 'INTEREST_TAG' },
      { tagId: 2, type: 'READ_HISTORY' },
    ]);
    const reasons = toReasons(item, new Map([[1, 'Kafka'], [2, 'Java']]));
    expect(reasons).toEqual([{ type: 'INTEREST_TAG', tagName: 'Kafka' }, { type: 'READ_HISTORY', tagName: 'Java' }]);
    expect(reasonLabel(reasons)).toBe('INTEREST_TAG:Kafka');
  });
});

describe('fillToMinimum', () => {
  it('부족하면 콜드 스타트 결과로 채우고 중복은 건너뜀', () => {
    const ranked = coldItems([{ postId: 1, sourceId: 1 }]).map((r) => ({ ...r, algorithm: 'TAG_V1' as const }));
    const cold = coldItems([{ postId: 1, sourceId: 1 }, { postId: 2, sourceId: 1 }, { postId: 3, sourceId: 2 }]);
    const filled = fillToMinimum(ranked, cold, 3);
    expect(filled.map((r) => [r.postId, r.algorithm])).toEqual([[1, 'TAG_V1'], [2, 'COLD_POPULAR'], [3, 'COLD_POPULAR']]);
    expect(toReasons(filled[1], new Map())).toEqual([{ type: 'POPULAR' }]);
  });
});

describe('diversify', () => {
  it('같은 소스는 최대 2개 연속', () => {
    const items = [1, 1, 1, 1, 2, 3].map((sourceId, i) => ({ sourceId, id: i }));
    expect(diversify(items).map((i) => i.sourceId)).toEqual([1, 1, 2, 1, 1, 3]);
  });

  it('다른 소스가 없으면 그대로 이어 붙임', () => {
    expect(diversify([1, 1, 1].map((sourceId) => ({ sourceId }))).map((i) => i.sourceId)).toEqual([1, 1, 1]);
  });
});
