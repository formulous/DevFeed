import { buildSearchQueries, needsPostsJoin } from './search-query';

describe('buildSearchQueries', () => {
  it('필터 없는 관련도순은 post_search만 사용함', () => {
    const { list, count } = buildSearchQueries({ match: '+kafka', sort: 'RELEVANCE', limit: 20, offset: 40 });
    expect(list.sql).not.toContain('JOIN');
    expect(list.sql).toContain('MATCH(s.title_tokens) AGAINST (? IN BOOLEAN MODE) * 2');
    expect(list.sql).toContain('ORDER BY score DESC, s.post_id DESC LIMIT ? OFFSET ?');
    expect(list.params).toEqual(['+kafka', '+kafka', '+kafka', 20, 40]);
    expect(count.sql).toBe(
      'SELECT COUNT(*) AS total FROM (SELECT 1 FROM post_search s WHERE MATCH(s.title_tokens, s.body_tokens) AGAINST (? IN BOOLEAN MODE) LIMIT ?) capped',
    );
    expect(count.params).toEqual(['+kafka', 1001]);
  });

  it('태그 필터만 있으면 조인 없이 post_tags EXISTS', () => {
    const { list } = buildSearchQueries({ match: '+x', sort: 'RELEVANCE', tagIds: [9, 3], limit: 20, offset: 0 });
    expect(list.sql).not.toContain('JOIN');
    expect(list.sql).toContain('pt.post_id = s.post_id AND pt.tag_id IN (?, ?)');
  });

  it('최신순·기간·소스 필터는 커버링 인덱스를 강제한 posts 조인', () => {
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
    expect(list.sql).toContain('JOIN posts p FORCE INDEX (idx_posts_search_filter) ON p.id = s.post_id');
    expect(list.sql).toContain('p.published_at >= ? AND p.source_id IN (?, ?) AND EXISTS');
    expect(list.sql).toContain('ORDER BY p.published_at DESC, p.id DESC');
    expect(list.sql).not.toContain('score');
    expect(count.params).toEqual(['+x', since, 1, 2, 9, 1001]);
  });

  it('조인 필요 여부', () => {
    const base = { match: '+x', limit: 20, offset: 0 };
    expect(needsPostsJoin({ ...base, sort: 'RELEVANCE' })).toBe(false);
    expect(needsPostsJoin({ ...base, sort: 'RELEVANCE', tagIds: [1] })).toBe(false);
    expect(needsPostsJoin({ ...base, sort: 'LATEST' })).toBe(true);
    expect(needsPostsJoin({ ...base, sort: 'RELEVANCE', since: new Date() })).toBe(true);
    expect(needsPostsJoin({ ...base, sort: 'RELEVANCE', sourceIds: [1] })).toBe(true);
  });
});
