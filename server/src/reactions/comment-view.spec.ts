import { CommentRow, toCommentView } from './comment-view';

const row = (over: Partial<CommentRow> = {}): CommentRow => ({
  id: '10',
  post_id: '3',
  parent_id: null,
  user_id: '7',
  body: '<script>alert(1)</script>',
  status: 'VISIBLE',
  reply_count: 2,
  edited_at: null,
  created_at: new Date('2026-11-21T00:00:00Z'),
  nickname: '작성자',
  score: 500,
  ...over,
});

describe('toCommentView', () => {
  it('보이는 댓글은 원문 그대로, 본인이면 mine', () => {
    expect(toCommentView(row(), { id: 7, role: 'USER' })).toMatchObject({
      id: 10,
      content: '<script>alert(1)</script>',
      author: { id: 7, nickname: '작성자', grade: { level: 3, name: 'Senior Dev' } },
      mine: true,
      replyCount: 2,
    });
    expect(toCommentView(row()).mine).toBe(false);
  });

  it('숨긴 댓글은 관리자에게만 내용·작성자, 본인은 mine만', () => {
    const hidden = row({ status: 'HIDDEN' });
    expect(toCommentView(hidden, { id: 7, role: 'USER' })).toMatchObject({ content: null, author: null, mine: true });
    expect(toCommentView(hidden, { id: 1, role: 'ADMIN' })).toMatchObject({ content: '<script>alert(1)</script>', author: { id: 7 } });
  });

  it('삭제 자리 표시는 내용·작성자 없음, 답글은 replyCount 0', () => {
    expect(toCommentView(row({ status: 'DELETED', body: null, user_id: null, nickname: null }), { id: 7, role: 'ADMIN' })).toMatchObject({
      content: null,
      author: null,
      mine: false,
    });
    expect(toCommentView(row({ parent_id: '9', reply_count: 5 })).replyCount).toBe(0);
  });

  it('reportedByMe는 회원이 신고한 댓글만 true (032)', () => {
    const reported = new Set([10]);
    expect(toCommentView(row(), { id: 3, role: 'USER' }, reported).reportedByMe).toBe(true);
    expect(toCommentView(row(), { id: 3, role: 'USER' }).reportedByMe).toBe(false);
    expect(toCommentView(row(), undefined, reported).reportedByMe).toBe(false);
  });
});
