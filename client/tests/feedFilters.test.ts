import { describe, expect, it } from 'vitest';
import { applyFeedFilters, parseFeedFilters } from '@/hooks/useFeedFilters';

describe('feed filters URL', () => {
  it('쿼리를 필터로 해석하고 잘못된 값은 버림', () => {
    const params = new URLSearchParams('tagIds=1,2,abc,2&sourceIds=3&sourceType=WRONG');
    expect(parseFeedFilters(params)).toEqual({ tagIds: [1, 2], sourceIds: [3], sourceType: null });
  });

  it('명세 상한(태그 10, 소스 20)을 넘는 값은 자름', () => {
    const ids = Array.from({ length: 25 }, (_, i) => i + 1).join(',');
    const parsed = parseFeedFilters(new URLSearchParams(`tagIds=${ids}&sourceIds=${ids}`));
    expect(parsed.tagIds).toHaveLength(10);
    expect(parsed.sourceIds).toHaveLength(20);
  });

  it('필터를 쿼리로 반영하고 빈 값은 제거함', () => {
    const next = applyFeedFilters(new URLSearchParams('q=keep&tagIds=9'), {
      tagIds: [],
      sourceIds: [4, 5],
      sourceType: 'PERSONAL',
    });
    expect(next.get('q')).toBe('keep');
    expect(next.has('tagIds')).toBe(false);
    expect(next.get('sourceIds')).toBe('4,5');
    expect(next.get('sourceType')).toBe('PERSONAL');
  });
});
