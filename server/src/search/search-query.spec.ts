import { buildSearchQueries } from './search-query';

describe('buildSearchQueries', () => {
  it('관련도순: 제목 가중 점수로 정렬하고 같은 조건으로 COUNT', () => {
    const { list, count } = buildSearchQueries({ match: '+kafka', sort: 'RELEVANCE', limit: 20, offset: 40 });
    expect(list.sql).toContain('MATCH(s.title_tokens) AGAINST (? IN BOOLEAN MODE) * 2');
    expect(list.sql).toContain('ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT ? OFFSET ?');
    expect(list.params).toEqual(['+kafka', '+kafka', '+kafka', 20, 40]);
    expect(count.sql).toMatch(/^SELECT COUNT\(\*\) AS total FROM post_search s JOIN posts p/);
    expect(count.params).toEqual(['+kafka']);
  });

  it('최신순은 점수를 계산하지 않음', () => {
    const { list } = buildSearchQueries({ match: '+kafka', sort: 'LATEST', limit: 20, offset: 0 });
    expect(list.sql).not.toContain('score');
    expect(list.sql).toContain('ORDER BY p.published_at DESC, p.id DESC');
  });

  it('기간·소스·태그 필터를 순서대로 바인딩함', () => {
    const since = new Date('2026-11-12T00:00:00Z');
    const { list, count } = buildSearchQueries({
      match: '+x',
      sort: 'LATEST',
      since,
      sourceIds: [1, 2],
      tagIds: [9],
      limit: 20,
      offset: 0,
    });
    expect(list.sql).toContain('p.published_at >= ? AND p.source_id IN (?, ?) AND EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag_id IN (?))');
    expect(count.params).toEqual(['+x', since, 1, 2, 9]);
  });
});
