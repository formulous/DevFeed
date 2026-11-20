import { FIELDS, groupTagsByField } from './fields';

describe('groupTagsByField', () => {
  it('분류 묶음대로 태그를 나누고, 묶이지 않는 분류는 어느 분야에도 넣지 않음', () => {
    const groups = groupTagsByField([
      { id: 3, category: 'Architecture' },
      { id: 1, category: 'Backend' },
      { id: 2, category: 'DevOps' },
      { id: 4, category: 'Language' },
      { id: 5, category: null },
      { id: 7, category: '백엔드' },
      { id: 6, category: 'Security' },
    ]);
    expect(groups.get('BACKEND')).toEqual([1, 3]);
    expect(groups.get('INFRA')).toEqual([2]);
    expect(groups.get('SECURITY')).toEqual([6]);
    expect(groups.get('MOBILE')).toEqual([]);
    expect([...groups.values()].flat()).not.toContain(4);
    expect([...groups.values()].flat()).not.toContain(7);
    expect([...groups.keys()]).toEqual([...FIELDS]);
  });
});
