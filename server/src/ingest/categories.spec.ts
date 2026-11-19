import { joinCategories, splitCategories } from './categories';

describe('joinCategories', () => {
  it('줄바꿈으로 연결하고 빈 값은 버림', () => {
    expect(joinCategories(['Kafka', ' ', 'Back, end|x'])).toBe('Kafka\nBack, end|x');
    expect(joinCategories([])).toBeNull();
  });

  it('최대 길이를 넘으면 카테고리 단위로 자름', () => {
    expect(joinCategories(['abcd', 'efgh', 'ijkl'], 10)).toBe('abcd\nefgh');
    expect(joinCategories(['abcdefghijk'], 10)).toBeNull();
  });

  it('저장값을 다시 배열로 복원함', () => {
    expect(splitCategories(joinCategories(['a', 'b c']))).toEqual(['a', 'b c']);
    expect(splitCategories(null)).toEqual([]);
  });
});
