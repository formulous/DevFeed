import { TagDictionary } from './tagger';

const dictionary = new TagDictionary([
  { id: 1, name: 'Kubernetes', synonyms: ['k8s', '쿠버네티스'] },
  { id: 2, name: 'Kafka', synonyms: ['카프카'] },
  { id: 3, name: 'Java', synonyms: [] },
  { id: 4, name: 'JavaScript', synonyms: ['JS'] },
  { id: 5, name: 'Go', synonyms: ['Golang'] },
  { id: 6, name: 'React', synonyms: ['리액트'] },
  { id: 7, name: 'C++', synonyms: [] },
  { id: 8, name: 'Spring', synonyms: [] },
]);

describe('TagDictionary.extract', () => {
  it('제목에 나온 태그를 등장 순서대로 우선함', () => {
    const result = dictionary.extract({
      title: '카프카 컨슈머를 쿠버네티스에서 운영하기',
      summary: 'React 이야기',
    });
    expect(result).toEqual([
      { tagId: 2, rank: 1 },
      { tagId: 1, rank: 2 },
      { tagId: 6, rank: 3 },
    ]);
  });

  it('영문 용어는 단어 경계로만 매칭함', () => {
    expect(dictionary.extract({ title: 'JavaScript 번들 줄이기' }).map((m) => m.tagId)).toEqual([4]);
    expect(dictionary.extract({ title: 'Google 검색 품질' })).toEqual([]);
    expect(dictionary.extract({ title: 'Modern C++ 템플릿' }).map((m) => m.tagId)).toEqual([7]);
  });

  it('피드 카테고리는 제목 다음, 요약보다 먼저 반영함', () => {
    const result = dictionary.extract({ title: '회고', summary: 'Spring 사용기', categories: ['golang'] });
    expect(result.map((m) => m.tagId)).toEqual([5, 8]);
  });

  it('최대 5개까지만 반환함', () => {
    const result = dictionary.extract({
      title: 'Kafka Java Spring React Go Kubernetes C++',
    });
    expect(result).toHaveLength(5);
    expect(result.map((m) => m.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});
