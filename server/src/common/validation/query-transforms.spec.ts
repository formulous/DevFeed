import { toIdList, toInt } from './query-transforms';

describe('query transforms', () => {
  it('쉼표 구분·반복 파라미터를 숫자 배열로 만들고 중복을 제거함', () => {
    expect(toIdList({ value: '1,2, 2' })).toEqual([1, 2]);
    expect(toIdList({ value: ['3', '4,5'] })).toEqual([3, 4, 5]);
    expect(toIdList({ value: '' })).toBeUndefined();
  });

  it('숫자가 아니면 NaN으로 남겨 검증에서 걸리게 함', () => {
    expect(toIdList({ value: '1,a' })).toEqual([1, NaN]);
    expect(toInt({ value: '20' })).toBe(20);
    expect(Number.isNaN(toInt({ value: '2x' }))).toBe(true);
  });
});
