import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { PostCard } from '@/components/post/PostCard';
import { compactNumber } from '@/lib/format';
import { mockPosts } from '@/mocks/fixtures';
import { server } from '@/mocks/node';
import { mockState } from '@/mocks/handlers';
import { BUSY_POST_ID } from '@/mocks/reactions';
import { renderWithApp, seedLogin } from './render';

const busy = mockPosts.find((p) => p.id === BUSY_POST_ID)!;

async function busyCard() {
  const link = await screen.findByRole('link', { name: busy.title });
  return link.closest('article')!.parentElement as HTMLElement;
}

async function openComments(user: ReturnType<typeof userEvent.setup>) {
  const card = await busyCard();
  await user.click(within(card).getByRole('button', { name: /^댓글 / }));
  return within(await within(card).findByRole('region', { name: '댓글' }));
}

describe('F-080·F-081 반응 줄 (026)', () => {
  it('목록 항목에 좋아요·댓글 수를 보여 주고 1,000 이상은 k로 줄임', async () => {
    renderWithApp(<App />, '/');
    const card = within(await busyCard());
    const like = card.getByRole('button', { name: '좋아요 1,234개' });
    expect(like).toHaveTextContent('1.2k');
    expect(card.getByRole('button', { name: /^댓글 \d+개$/ })).toHaveAttribute('aria-expanded', 'false');
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(12_345)).toBe('12.3k');
  });

  it('서버 응답에 likeCount가 없으면 반응 줄을 그리지 않음 (server 배포 전)', () => {
    const { likeCount: _l, commentCount: _c, likedByMe: _m, ...plain } = { ...busy, likeCount: 1, commentCount: 1, likedByMe: false };
    render(<PostCard post={plain} onOpen={() => undefined} onToggleBookmark={() => undefined} />);
    expect(screen.queryByRole('button', { name: /^좋아요/ })).toBeNull();
  });

  it('게스트가 좋아요를 누르면 로그인 안내, 원문 조회 기록은 남지 않음', async () => {
    const views: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/views')) views.push(request.url);
    });
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const card = within(await busyCard());
    await user.click(card.getByRole('button', { name: /^좋아요/ }));
    expect(await screen.findByText('좋아요를 누르려면 로그인이 필요해요')).toBeInTheDocument();
    expect(views).toHaveLength(0);
    server.events.removeAllListeners();
  });

  it('게스트는 댓글을 읽을 수 있고 입력창 대신 로그인 안내가 보임', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const region = await openComments(user);
    expect(await region.findByText(/리밸런싱 시간 줄이는 설정/)).toBeInTheDocument();
    expect(region.getByText('삭제된 댓글이에요')).toBeInTheDocument();
    expect(region.getByText('관리자가 숨긴 댓글이에요')).toBeInTheDocument();
    expect(region.queryByText('광고성 댓글')).toBeNull();
    expect(region.getByText('<script>alert(1)</script> 이건 글자 그대로 보여야 해요')).toBeInTheDocument();
    expect(document.querySelector('section script')).toBeNull();
    expect(region.queryByRole('textbox')).toBeNull();
    expect(region.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?redirect=%2F');
  });

  it('답글은 3개까지 먼저 보이고 더보기로 나머지를, 댓글 더보기로 다음 페이지를 불러옴', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const region = await openComments(user);
    await region.findByText(/리밸런싱 시간 줄이는 설정/);
    expect(region.getAllByText(/^답글 \d: /)).toHaveLength(3);
    await user.click(region.getByRole('button', { name: '답글 2개 더보기' }));
    await waitFor(() => expect(region.getAllByText(/^답글 \d: /)).toHaveLength(5));
    expect(region.queryByRole('button', { name: /답글 .*더보기/ })).toBeNull();
    const before = region.getAllByText(/^댓글 \d+: /).length;
    await user.click(region.getByRole('button', { name: '댓글 더보기' }));
    await waitFor(() => expect(region.getAllByText(/^댓글 \d+: /).length).toBeGreaterThan(before));
    expect(region.queryByRole('button', { name: '댓글 더보기' })).toBeNull();
  });

  it('회원 좋아요는 바로 반영되고 연타해도 마지막 상태로 맞춰짐', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const card = within(await busyCard());
    const like = () => card.getByRole('button', { name: /^좋아요/ });
    await waitFor(() => expect(like()).toHaveAttribute('aria-pressed', 'false'));
    await user.click(like());
    expect(like()).toHaveAttribute('aria-pressed', 'true');
    expect(like()).toHaveAccessibleName('좋아요 1,235개');
    for (let i = 0; i < 4; i++) await user.click(like());
    await waitFor(() => expect(like()).toHaveAccessibleName('좋아요 1,235개'));
    expect(like()).toHaveAttribute('aria-pressed', 'true');
  });

  it('좋아요 실패 시 되돌리고 안내함', async () => {
    await seedLogin('user@devfeed.dev');
    server.use(http.put('*/api/posts/:id/like', () => HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 })));
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const card = within(await busyCard());
    await waitFor(() => expect(card.getByRole('button', { name: /^좋아요/ })).toHaveAttribute('aria-pressed', 'false'));
    await user.click(card.getByRole('button', { name: /^좋아요/ }));
    expect(await screen.findByText('좋아요를 반영하지 못했어요')).toBeInTheDocument();
    expect(card.getByRole('button', { name: /^좋아요/ })).toHaveAccessibleName('좋아요 1,234개');
  });

  it('회원은 댓글·답글을 쓰고 고치고 지울 수 있고, 댓글 수가 함께 바뀜', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const card = within(await busyCard());
    const countButton = () => card.getByRole('button', { name: /^댓글 \d+개$/ });
    await waitFor(() => expect(countButton()).toBeInTheDocument());
    const start = Number(countButton().getAttribute('aria-label')!.match(/\d+/)![0]);
    const region = await openComments(user);
    await region.findByText(/리밸런싱 시간 줄이는 설정/);

    const input = region.getByRole('textbox', { name: '댓글 입력' });
    await user.type(input, '   ');
    expect(region.getByRole('button', { name: '등록' })).toBeDisabled();
    await user.clear(input);
    await user.type(input, '  새 댓글이에요  ');
    await user.click(region.getByRole('button', { name: '등록' }));
    await region.findByText('새 댓글이에요');
    expect(countButton()).toHaveAccessibleName(`댓글 ${start + 1}개`);
    expect(input).toHaveValue('');

    const mine = within(region.getByText('새 댓글이에요').closest('li')!);
    await user.click(mine.getByRole('button', { name: '수정' }));
    const edit = mine.getByRole('textbox', { name: '댓글 수정' });
    await user.clear(edit);
    await user.type(edit, '고친 댓글이에요');
    await user.click(mine.getByRole('button', { name: '저장' }));
    await region.findByText('고친 댓글이에요');
    expect(within(region.getByText('고친 댓글이에요').closest('li')!).getByText('(수정됨)')).toBeInTheDocument();

    await user.click(within(region.getByText('고친 댓글이에요').closest('li')!).getByRole('button', { name: '답글 달기' }));
    await user.type(region.getByRole('textbox', { name: '답글 입력' }), '내 답글');
    await user.click(within(region.getByRole('textbox', { name: '답글 입력' }).closest('form')!).getByRole('button', { name: '등록' }));
    await region.findByText('내 답글');
    expect(countButton()).toHaveAccessibleName(`댓글 ${start + 2}개`);

    const parentLi = region.getByText('고친 댓글이에요').closest('li')!;
    await user.click(within(parentLi).getAllByRole('button', { name: '삭제' })[0]);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(region.queryByText('고친 댓글이에요')).toBeNull());
    expect(within(region.getByText('내 답글').closest('ul')!.closest('li')!).getByText('삭제된 댓글이에요')).toBeInTheDocument();
    expect(countButton()).toHaveAccessibleName(`댓글 ${start + 1}개`);

    await user.click(within(region.getByText('내 답글').closest('li')!).getByRole('button', { name: '삭제' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(region.queryByText('내 답글')).toBeNull());
    expect(region.getAllByText('삭제된 댓글이에요')).toHaveLength(1);
    expect(countButton()).toHaveAccessibleName(`댓글 ${start}개`);
  });

  it('속도 제한이면 안내하고 입력은 남겨 둠', async () => {
    await seedLogin('user@devfeed.dev');
    server.use(
      http.post('*/api/posts/:id/comments', () =>
        HttpResponse.json({ code: 'COMMENT_RATE_LIMITED', message: '잠시 후 다시 남겨 주세요', retryAfterSec: 30 }, { status: 429 }),
      ),
    );
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const region = await openComments(user);
    const input = await region.findByRole('textbox', { name: '댓글 입력' });
    await user.type(input, '빠른 댓글');
    await user.click(region.getByRole('button', { name: '등록' }));
    expect(await screen.findByText('잠시 후 다시 남겨 주세요')).toBeInTheDocument();
    expect(input).toHaveValue('빠른 댓글');
  });

  it('관리자는 댓글을 숨기고 숨김을 풀 수 있음', async () => {
    await seedLogin('admin@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const card = within(await busyCard());
    const countButton = () => card.getByRole('button', { name: /^댓글 \d+개$/ });
    await waitFor(() => expect(countButton()).toBeInTheDocument());
    const start = Number(countButton().getAttribute('aria-label')!.match(/\d+/)![0]);
    const region = await openComments(user);
    expect(await region.findByText('광고성 댓글')).toBeInTheDocument();
    const first = within(region.getByText(/리밸런싱 시간 줄이는 설정/).closest('div')!);
    await user.click(first.getByRole('button', { name: '숨김' }));
    await waitFor(() => expect(region.getAllByText('관리자가 숨긴 댓글이에요')).toHaveLength(2));
    expect(countButton()).toHaveAccessibleName(`댓글 ${start - 1}개`);
    await user.click(region.getAllByRole('button', { name: '숨김 해제' })[0]);
    await waitFor(() => expect(region.getAllByText('관리자가 숨긴 댓글이에요')).toHaveLength(1));
    expect(countButton()).toHaveAccessibleName(`댓글 ${start}개`);
  });

  it('읽은 기록 화면에는 반응 줄이 없음', async () => {
    await seedLogin('user@devfeed.dev');
    mockState.reads.set(busy.id, new Date().toISOString());
    renderWithApp(<App />, '/me/history');
    await screen.findByRole('link', { name: busy.title });
    expect(screen.queryByRole('button', { name: /^좋아요/ })).toBeNull();
  });
});
