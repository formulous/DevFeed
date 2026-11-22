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

  it('보안 뉴스는 별도 색인, 출처 필터는 같은 방식의 posts 조인 (038)', () => {
    const plain = buildSearchQueries({ match: '+x', scope: 'SECURITY', sort: 'RELEVANCE', limit: 20, offset: 0 });
    expect(plain.list.sql).toContain('FROM security_news_search s WHERE');
    expect(plain.list.sql).not.toContain('JOIN');
    const filtered = buildSearchQueries({ match: '+x', scope: 'SECURITY', sort: 'RELEVANCE', sourceIds: [4], limit: 20, offset: 0 });
    expect(filtered.list.sql).toContain('FROM security_news_search s JOIN posts p FORCE INDEX (idx_posts_search_filter)');
    expect(filtered.list.sql).toContain('p.source_id IN (?)');
  });

  it('자유 게시판은 보이는 글 조인, 말머리·기간·최신순은 community_posts 기준 (038)', () => {
    const since = new Date('2026-11-12T00:00:00Z');
    const { list, count } = buildSearchQueries({ match: '+x', scope: 'COMMUNITY', sort: 'LATEST', since, category: 'QUESTION', limit: 20, offset: 0 });
    expect(list.sql).toContain("FROM community_search s JOIN community_posts cp ON cp.post_id = s.post_id AND cp.status = 'VISIBLE'");
    expect(list.sql).not.toContain('JOIN posts');
    expect(list.sql).toContain('cp.published_at >= ? AND cp.category = ?');
    expect(list.sql).toContain('ORDER BY cp.published_at DESC, cp.post_id DESC');
    expect(count.params).toEqual(['+x', since, 'QUESTION', 1001]);
    const relevance = buildSearchQueries({ match: '+x', scope: 'COMMUNITY', sort: 'RELEVANCE', limit: 20, offset: 0 });
    expect(relevance.count.sql).toContain("cp.status = 'VISIBLE'");
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
