import { assembleCards, withoutViewCount } from './post-cards';

const row = (id: number) => ({
  id: String(id),
  kind: 'BLOG' as const,
  title: `t${id}`,
  summary: null,
  url: `https://a.com/${id}`,
  thumbnail_url: null,
  published_at: new Date('2026-11-19T00:00:00Z'),
  view_count: id * 10,
  like_count: id,
  comment_count: id * 2,
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
    const [card] = assembleCards([1], [row(1)], [], { bookmarked: new Set([1]), read: new Set(), liked: new Set() });
    expect(card).toMatchObject({ isBookmarked: true, isRead: false });
    expect(withoutViewCount(card)).not.toHaveProperty('viewCount');
  });

  it('인기 집합에 든 글만 isPopular true, 집합이 없으면 모두 false', () => {
    const cards = assembleCards([1, 2], [row(1), row(2)], [], undefined, new Set([2]));
    expect(cards.map((c) => c.isPopular)).toEqual([false, true]);
    expect(assembleCards([1], [row(1)], [])[0].isPopular).toBe(false);
  });

  it('좋아요·댓글 수는 항상, likedByMe는 비회원 false (026)', () => {
    const [guest] = assembleCards([1], [row(1)], []);
    expect(guest).toMatchObject({ likeCount: 1, commentCount: 2, likedByMe: false });
    const [member] = assembleCards([1], [row(1)], [], { bookmarked: new Set(), read: new Set(), liked: new Set([1]) });
    expect(member.likedByMe).toBe(true);
  });

  it('모든 카드에 kind, 커뮤니티 글만 community (032)', () => {
    const community = {
      ...row(3),
      kind: 'COMMUNITY' as const,
      category: 'QUESTION' as const,
      author_id: '7',
      author_nickname: '작성자',
      author_score: 120,
      edited_at: null,
      accepted_comment_id: '11',
    };
    const [blog, post] = assembleCards([1, 3], [row(1), community], []);
    expect(blog.kind).toBe('BLOG');
    expect(blog).not.toHaveProperty('community');
    expect(post.community).toEqual({
      category: 'QUESTION',
      author: { id: 7, nickname: '작성자', grade: { level: 2, name: 'Junior Dev' } },
      editedAt: null,
      solved: true,
      viewCount: 30,
    });
    const deleted = assembleCards([3], [{ ...community, category: 'DISCUSSION' as const, author_id: null, author_nickname: null }], [])[0];
    expect(deleted.community).toMatchObject({ author: null, solved: false });
  });

  it('사라진 글은 건너뜀', () => {
    expect(assembleCards([5], [], [])).toEqual([]);
  });
});
