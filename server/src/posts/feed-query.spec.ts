import { buildFeedQuery } from './feed-query';

const cursor = { at: new Date('2026-11-19T00:00:00Z'), id: 50 };
const flat = (sql: string) => sql.replace(/\s+/g, ' ');

describe('buildFeedQuery', () => {
  it('필터 없음: posts 단일 쿼리 + 종류 + 커서', () => {
    const q = buildFeedQuery({ limit: 21, cursor });
    expect(flat(q.sql)).toBe(
      'SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE p.kind = ? AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?)) ORDER BY p.published_at DESC, p.id DESC LIMIT ?',
    );
    expect(q.params).toEqual(['BLOG', cursor.at, cursor.at, 50, 21]);
  });

  it('보안 뉴스 종류는 같은 경로에서 kind만 바뀜', () => {
    const q = buildFeedQuery({ limit: 21, kind: 'SECURITY_NEWS' });
    expect(q.params).toEqual(['SECURITY_NEWS', 21]);
  });

  it('유형 탭은 kind + source_type', () => {
    const q = buildFeedQuery({ limit: 21, sourceType: 'PERSONAL' });
    expect(q.sql).toContain('p.kind = ? AND p.source_type = ?');
    expect(q.params).toEqual(['BLOG', 'PERSONAL', 21]);
  });

  it('분야만 있으면 분야 태그별 post_tags UNION', () => {
    const q = buildFeedQuery({ limit: 21, fieldTagIds: [4, 5, 6] });
    expect(q.sql.match(/ UNION /g)).toHaveLength(2);
    expect(q.sql).not.toContain('EXISTS');
    expect(q.params).toEqual([4, 'BLOG', 21, 5, 'BLOG', 21, 6, 'BLOG', 21, 21]);
  });

  it('분야 + 태그: 선택 태그가 드라이브하고 분야는 EXISTS', () => {
    const q = buildFeedQuery({ limit: 21, tagIds: [7], fieldTagIds: [4, 5] });
    expect(q.sql.startsWith('SELECT pt.post_id')).toBe(true);
    expect(q.sql).toContain('EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = pt.post_id AND fx.tag_id IN (?, ?))');
    expect(q.params).toEqual([7, 'BLOG', 4, 5, 21]);
  });

  it('분야 + 소스: 소스별 서브쿼리가 드라이브하고 분야는 EXISTS', () => {
    const q = buildFeedQuery({ limit: 21, sourceIds: [3, 4], fieldTagIds: [9] });
    expect(q.sql.match(/fx.post_id = p.id/g)).toHaveLength(2);
    expect(q.params).toEqual([3, 9, 21, 4, 9, 21, 21]);
  });

  it('소스 1개는 등호, 유형은 같은 쿼리에서 거름', () => {
    const q = buildFeedQuery({ limit: 21, sourceIds: [3], sourceType: 'COMPANY' });
    expect(q.sql).toContain('p.source_id = ? AND p.source_type = ?');
    expect(q.params).toEqual([3, 'COMPANY', 21]);
  });

  it('소스 여러 개는 소스별 UNION ALL 후 바깥 정렬', () => {
    const q = buildFeedQuery({ limit: 21, sourceIds: [3, 4] });
    expect(q.sql.match(/UNION ALL/g)).toHaveLength(1);
    expect(q.sql).toMatch(/\) f ORDER BY published_at DESC, id DESC LIMIT \?$/);
    expect(q.params).toEqual([3, 21, 4, 21, 21]);
  });

  it('태그 1개는 post_tags 인덱스만 사용, 조인 없음', () => {
    const q = buildFeedQuery({ limit: 21, tagIds: [7], cursor });
    expect(q.sql).not.toContain('JOIN');
    expect(q.sql.startsWith('SELECT pt.post_id')).toBe(true);
    expect(q.params).toEqual([7, 'BLOG', cursor.at, cursor.at, 50, 21]);
  });

  it('태그 여러 개는 태그별 UNION(중복 제거), 소스 조건은 각 서브쿼리 안 조인으로', () => {
    const q = buildFeedQuery({ limit: 21, tagIds: [7, 8], sourceIds: [1, 2] });
    expect(q.sql).toContain(' UNION ');
    expect(q.sql).not.toContain('UNION ALL');
    expect(q.sql.match(/JOIN posts p/g)).toHaveLength(2);
    expect(q.params).toEqual([7, 'BLOG', 1, 2, 21, 8, 'BLOG', 1, 2, 21, 21]);
  });
});
