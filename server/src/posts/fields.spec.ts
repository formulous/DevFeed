import { FIELDS, groupTagsByField } from './fields';

describe('groupTagsByField', () => {
  it('분류 묶음대로 태그를 나누고, 묶이지 않는 분류는 어느 분야에도 넣지 않음', () => {
    const groups = groupTagsByField([
      { id: 3, category: '아키텍처' },
      { id: 1, category: '백엔드' },
      { id: 2, category: 'DevOps' },
      { id: 4, category: '언어' },
      { id: 5, category: null },
      { id: 6, category: '보안' },
    ]);
    expect(groups.get('BACKEND')).toEqual([1, 3]);
    expect(groups.get('INFRA')).toEqual([2]);
    expect(groups.get('SECURITY')).toEqual([6]);
    expect(groups.get('MOBILE')).toEqual([]);
    expect([...groups.values()].flat()).not.toContain(4);
    expect([...groups.keys()]).toEqual([...FIELDS]);
  });

  it('023 전환 중에는 한글·영어 분류 값을 같은 분야로 묶음', () => {
    const groups = groupTagsByField([
      { id: 1, category: '백엔드' },
      { id: 2, category: 'Backend' },
      { id: 3, category: 'Architecture' },
      { id: 4, category: 'Database' },
      { id: 5, category: 'Cloud' },
      { id: 6, category: 'Security' },
      { id: 7, category: 'Language' },
    ]);
    expect(groups.get('BACKEND')).toEqual([1, 2, 3]);
    expect(groups.get('DATA')).toEqual([4]);
    expect(groups.get('INFRA')).toEqual([5]);
    expect(groups.get('SECURITY')).toEqual([6]);
    expect([...groups.values()].flat()).not.toContain(7);
  });
});
