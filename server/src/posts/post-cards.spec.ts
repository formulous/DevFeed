import { assembleCards, withoutViewCount } from './post-cards';

const row = (id: number) => ({
  id: String(id),
  title: `t${id}`,
  summary: null,
  url: `https://a.com/${id}`,
  thumbnail_url: null,
  published_at: new Date('2026-11-19T00:00:00Z'),
  view_count: id * 10,
  source_id: '1',
  source_name: 's',
  source_logo_url: null,
  source_type: 'COMPANY' as const,
});

describe('assembleCards', () => {
  it('요청 순서를 유지하고 태그를 rank 순서대로 붙임', () => {
    const cards = assembleCards([2, 1], [row(1), row(2)], [
      { post_id: 1, id: 9, name: 'Kafka' },
      { post_id: 1, id: 8, name: 'Java' },
    ]);
    expect(cards.map((c) => c.id)).toEqual([2, 1]);
    expect(cards[1].tags).toEqual([{ id: 9, name: 'Kafka' }, { id: 8, name: 'Java' }]);
    expect(cards[0].tags).toEqual([]);
    expect(cards[0]).not.toHaveProperty('isRead');
  });

  it('회원이면 북마크·읽음 플래그를 붙임', () => {
    const [card] = assembleCards([1], [row(1)], [], { bookmarked: new Set([1]), read: new Set() });
    expect(card).toMatchObject({ isBookmarked: true, isRead: false });
    expect(withoutViewCount(card)).not.toHaveProperty('viewCount');
  });

  it('인기 집합에 든 글만 isPopular true, 집합이 없으면 모두 false', () => {
    const cards = assembleCards([1, 2], [row(1), row(2)], [], undefined, new Set([2]));
    expect(cards.map((c) => c.isPopular)).toEqual([false, true]);
    expect(assembleCards([1], [row(1)], [])[0].isPopular).toBe(false);
  });

  it('사라진 글은 건너뜀', () => {
    expect(assembleCards([5], [], [])).toEqual([]);
  });
});
