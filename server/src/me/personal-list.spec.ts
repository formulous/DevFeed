import { bookmarkListQuery, historyListQuery } from './personal-list';

const cursor = { at: new Date('2026-11-19T00:00:00Z'), id: 7 };

describe('personal list queries', () => {
  it('북마크: 회원·커서·태그 순으로 바인딩, 저장 시각 역순', () => {
    const q = bookmarkListQuery(3, 21, cursor, [1, 2]);
    expect(q.sql).toContain('ORDER BY b.created_at DESC, b.post_id DESC LIMIT ?');
    expect(q.sql).toContain('pt.post_id = b.post_id AND pt.tag_id IN (?, ?)');
    expect(q.params).toEqual([3, cursor.at, cursor.at, 7, 1, 2, 21]);
  });

  it('북마크: 첫 페이지·태그 없음', () => {
    expect(bookmarkListQuery(3, 21).params).toEqual([3, 21]);
  });

  it('읽은 기록: 마지막 읽은 시각 역순', () => {
    const q = historyListQuery(3, 21, cursor);
    expect(q.sql).toContain('ORDER BY h.last_read_at DESC, h.post_id DESC LIMIT ?');
    expect(q.params).toEqual([3, cursor.at, cursor.at, 7, 21]);
  });
});
