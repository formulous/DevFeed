import { buildFeedQuery } from './feed-query';

const cursor = { at: new Date('2026-11-19T00:00:00Z'), id: 50 };
const flat = (sql: string) => sql.replace(/\s+/g, ' ');

describe('buildFeedQuery', () => {
  it('필터 없음: posts 단일 쿼리 + 커서', () => {
    const q = buildFeedQuery({ limit: 21, cursor });
    expect(flat(q.sql)).toBe(
      'SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE (p.published_at < ? OR (p.published_at = ? AND p.id < ?)) ORDER BY p.published_at DESC, p.id DESC LIMIT ?',
    );
    expect(q.params).toEqual([cursor.at, cursor.at, 50, 21]);
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
    expect(q.params).toEqual([7, cursor.at, cursor.at, 50, 21]);
  });

  it('태그 여러 개는 태그별 UNION(중복 제거), 소스 조건은 각 서브쿼리 안 조인으로', () => {
    const q = buildFeedQuery({ limit: 21, tagIds: [7, 8], sourceIds: [1, 2] });
    expect(q.sql).toContain(' UNION ');
    expect(q.sql).not.toContain('UNION ALL');
    expect(q.sql.match(/JOIN posts p/g)).toHaveLength(2);
    expect(q.params).toEqual([7, 1, 2, 21, 8, 1, 2, 21, 21]);
  });
});
