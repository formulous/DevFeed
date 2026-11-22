import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import Markdown from '@/components/markdown/Markdown';
import { XSS_BODY } from '@/mocks/community';
import { community, MY_POST_ID, SOLVED_POST_ID, XSS_POST_ID } from '@/mocks/communityStore';
import { mockState } from '@/mocks/handlers';
import { server } from '@/mocks/node';
import { currentLocation, renderWithApp, seedLogin } from './render';

const W = window as unknown as { __xss?: number };

describe('F-090 마크다운 안전 렌더러', () => {
  it('원시 HTML·이미지·javascript 링크는 실행되지 않고 글자로만 보임', async () => {
    W.__xss = undefined;
    const { container } = render(<Markdown source={XSS_BODY} />);
    expect(container.querySelector('script, img, iframe, [onerror], [onclick]')).toBeNull();
    expect(container.textContent).toContain('<script>window.__xss = 1</script>');
    expect(container.textContent).toContain('<img src=x onerror="window.__xss = 2">');
    expect(screen.getByText('[이미지: 추적 이미지]')).toBeInTheDocument();
    const fake = screen.getByText('눌러 보세요');
    expect(fake.closest('a')).toBeNull();
    const links = [...container.querySelectorAll('a')];
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://example.com/docs');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'nofollow ugc noopener noreferrer');
    expect(W.__xss).toBeUndefined();
  });

  it('코드 블록은 언어별로 하이라이트되고 복사 버튼이 있음, h1은 h2로 낮춤', () => {
    const { container } = render(
      <Markdown source={'# 제목\n\n```java\nint a = 1; // 주석\n```\n\n```nope\nplain\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |'} />,
    );
    expect(container.querySelector('h1')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: '제목' })).toBeInTheDocument();
    const codes = container.querySelectorAll('pre code');
    expect(codes[0]).toHaveClass('hljs');
    expect(codes[0].querySelector('.hljs-keyword, .hljs-type')).not.toBeNull();
    expect(codes[0].querySelector('.hljs-comment')).not.toBeNull();
    expect(codes[1].querySelector('span')).toBeNull();
    expect(screen.getAllByRole('button', { name: '코드 복사' })).toHaveLength(2);
    expect(container.querySelector('table')).not.toBeNull();
  });
});

describe('S-16 커뮤니티 목록', () => {
  it('1단 탭 자유 게시판 · 내부 탭 최신·인기·댓글·좋아요 · 말머리 필터, 카드는 상세로 감', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/community');
    const first = await screen.findAllByRole('article');
    expect(first.length).toBeGreaterThan(5);
    expect(screen.getByRole('heading', { level: 1, name: '자유 게시판' })).toBeInTheDocument();
    expect(within(screen.getByTestId('section-tabs')).getAllByRole('link').map((l) => l.textContent)).toEqual(['최신', '인기', '댓글', '좋아요']);
    const group = screen.getByRole('radiogroup', { name: '말머리' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['전체', '질문', '토론', '공유']);
    expect(screen.queryByRole('radiogroup', { name: '분야' })).toBeNull();

    const solved = screen.getByRole('link', { name: 'Kafka 컨슈머 랙이 계속 쌓여요' });
    expect(solved).toHaveAttribute('href', `/community/posts/${SOLVED_POST_ID}`);
    expect(within(solved.closest('article')!).getByText('해결됨')).toBeInTheDocument();

    await user.click(within(group).getByRole('radio', { name: '공유' }));
    await waitFor(() => expect(currentLocation).toBe('/community?category=share'));
    await waitFor(() => {
      const cards = screen.getAllByRole('article');
      expect(cards.every((c) => within(c).queryByText('공유'))).toBe(true);
    });
    await user.click(within(screen.getByTestId('section-tabs')).getByRole('link', { name: '인기' }));
    expect(currentLocation).toBe('/community/popular?category=share');
    expect(await screen.findByRole('list', { name: '자유 게시판 인기 글 순위' })).toBeInTheDocument();
  });

  it('비회원이 글쓰기를 누르면 로그인 안내만 뜸', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/community');
    await screen.findAllByRole('article');
    await user.click(screen.getAllByRole('button', { name: '글쓰기' })[0]);
    expect(await screen.findByText('글을 쓰려면 로그인이 필요해요')).toBeInTheDocument();
    expect(currentLocation).toBe('/community');
  });

  it('기술 뉴스 최신에는 커뮤니티 글이 섞이지 않음', async () => {
    renderWithApp(<App />, '/tech');
    await screen.findAllByRole('article');
    expect(screen.queryByRole('link', { name: 'Kafka 컨슈머 랙이 계속 쌓여요' })).toBeNull();
  });
});

describe('S-17 커뮤니티 글 상세', () => {
  it('본문 마크다운·채택 댓글 맨 위 고정·조회 기록', async () => {
    const before = community.posts.get(SOLVED_POST_ID)!.viewCount;
    renderWithApp(<App />, `/community/posts/${SOLVED_POST_ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Kafka 컨슈머 랙이 계속 쌓여요' })).toBeInTheDocument();
    expect(await screen.findByTestId('markdown')).toBeInTheDocument();
    const region = within(screen.getByRole('region', { name: '댓글' }));
    const badge = await region.findByText('채택');
    const items = region.getAllByRole('listitem');
    expect(items[0]).toContainElement(badge);
    await waitFor(() => expect(community.posts.get(SOLVED_POST_ID)!.viewCount).toBe(before + 1));
  });

  it('XSS 글도 상세에서 스크립트 없이 글자로 보임', async () => {
    W.__xss = undefined;
    renderWithApp(<App />, `/community/posts/${XSS_POST_ID}`);
    const md = await screen.findByTestId('markdown');
    expect(md.querySelector('script, img, iframe')).toBeNull();
    expect(md.textContent).toContain('<script>');
    expect(W.__xss).toBeUndefined();
  });

  it('없는 글·숨긴 글(남의 것)은 찾을 수 없음 화면', async () => {
    renderWithApp(<App />, '/community/posts/5012');
    expect(await screen.findByText('글을 찾을 수 없어요')).toBeInTheDocument();
  });

  it('관리자는 숨긴 글을 안내와 함께 보고 숨김을 풀 수 있음', async () => {
    await seedLogin('admin@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/community/posts/5012');
    expect(await screen.findByText('숨겨진 글이에요. 작성자와 관리자만 볼 수 있어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '숨김 해제' }));
    await waitFor(() => expect(community.posts.get(5012)!.status).toBe('VISIBLE'));
    expect(screen.queryByText('숨겨진 글이에요. 작성자와 관리자만 볼 수 있어요')).toBeNull();
  });

  it('질문 작성자는 남의 최상위 댓글을 채택·취소하고, 채택된 내 댓글엔 삭제가 없음', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, `/community/posts/${MY_POST_ID}`);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: '수정' })).toHaveAttribute('href', `/community/posts/${MY_POST_ID}/edit`);
    const region = within(screen.getByRole('region', { name: '댓글' }));
    const buttons = await region.findAllByRole('button', { name: '채택' });
    await user.click(buttons[buttons.length - 1]);
    expect(await screen.findByText('답을 채택했어요')).toBeInTheDocument();
    await waitFor(() => expect(community.posts.get(MY_POST_ID)!.acceptedCommentId).not.toBeNull());
    expect(region.getAllByRole('listitem')[0]).toContainElement(region.getByRole('button', { name: '채택 취소' }));
    await user.click(region.getByRole('button', { name: '채택 취소' }));
    await waitFor(() => expect(community.posts.get(MY_POST_ID)!.acceptedCommentId).toBeNull());
  });

  it('댓글 신고 후 "신고함"으로 바뀌고, 서로 다른 3명째 신고면 글이 자동으로 숨겨짐', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/community/posts/5010');
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('button', { name: '신고' })[0]);
    const dialog = within(await screen.findByRole('dialog', { name: '글 신고' }));
    expect(dialog.getByRole('button', { name: '신고하기' })).toBeDisabled();
    await user.click(dialog.getByRole('radio', { name: '기타' }));
    expect(dialog.getByRole('button', { name: '신고하기' })).toBeDisabled();
    await user.type(dialog.getByRole('textbox', { name: '기타 사유' }), '광고 같아요');
    await user.click(dialog.getByRole('button', { name: '신고하기' }));
    expect(await screen.findByText('신고했어요. 관리자가 확인할게요')).toBeInTheDocument();
    expect(community.posts.get(5010)!.status).toBe('HIDDEN');
    expect(screen.getByRole('button', { name: '신고함' })).toBeDisabled();
  });

  it('신고 중복·자기 글은 코드별 안내', async () => {
    await seedLogin('user@devfeed.dev');
    server.use(http.post('*/api/reports', () => HttpResponse.json({ code: 'REPORT_OWN_CONTENT', message: 'x' }, { status: 403 })));
    const user = userEvent.setup();
    renderWithApp(<App />, `/community/posts/${SOLVED_POST_ID}`);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('button', { name: '신고' })[0]);
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: '스팸' }));
    await user.click(dialog.getByRole('button', { name: '신고하기' }));
    expect(await dialog.findByText('내 글이나 댓글은 신고할 수 없어요')).toBeInTheDocument();
  });

  it('작성자 삭제: 댓글이 있으면 목록에서 빠지고 상세는 "삭제된 글이에요"', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, `/community/posts/${MY_POST_ID}`);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: '삭제' }));
    const dialog = within(await screen.findByRole('dialog', { name: '글 삭제' }));
    expect(dialog.getByText(/삭제된 글이에요/)).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(currentLocation).toBe('/community'));
    await screen.findAllByRole('article');
    expect(screen.queryByRole('link', { name: '내가 쓴 첫 글이에요' })).toBeNull();
  });
});

describe('S-18 글 쓰기·수정', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, title: string, body: string) => {
    await user.type(await screen.findByLabelText('제목'), title);
    const textarea = screen.getByRole('textbox', { name: '본문' });
    await user.click(textarea);
    await user.paste(body);
  };

  it('말머리·제목·본문으로 올리면 상세로 가고 점수·글 수가 오름, 바로 다시 쓰면 60초 안내', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/community/new?category=share');
    expect(await screen.findByRole('radio', { name: '공유' })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('오늘 5개 더 쓸 수 있어요')).toBeInTheDocument();
    await fill(user, '새 글 제목', '본문은 **마크다운**이에요\n\n```ts\nconst a = 1;\n```');
    await user.click(screen.getByRole('tab', { name: '미리보기' }));
    const preview = await screen.findByTestId('markdown');
    expect(within(preview).getByText('마크다운').tagName).toBe('STRONG');
    await user.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('글을 올렸어요')).toBeInTheDocument();
    await waitFor(() => expect(currentLocation).toMatch(/^\/community\/posts\/\d+$/));
    expect(await screen.findByRole('heading', { level: 1, name: '새 글 제목' })).toBeInTheDocument();
    const mine = [...community.posts.values()].find((p) => p.title === '새 글 제목')!;
    expect(mine.scored).toBe(true);
    expect(mine.category).toBe('SHARE');
  });

  it('60초 안에 다시 쓰면 버튼 대신 남은 시간 안내', async () => {
    await seedLogin('user@devfeed.dev');
    community.writes.push({ userId: 1, at: Date.now() - 10_000 });
    renderWithApp(<App />, '/community/new');
    expect(await screen.findByRole('alert')).toHaveTextContent(/글은 1분에 하나씩 쓸 수 있어요. \d+초 뒤에/);
    expect(screen.queryByRole('button', { name: '올리기' })).toBeNull();
  });

  it('가입 24시간 안 된 계정은 글쓰기 대신 안내, 하루 5개면 하루 제한 안내', async () => {
    await seedLogin('newbie@devfeed.dev');
    const first = renderWithApp(<App />, '/community/new');
    expect(await screen.findByRole('alert')).toHaveTextContent('가입하고 24시간이 지나면 글을 쓸 수 있어요');
    first.unmount();
    mockState.me = { ...mockState.me!, createdAt: '2026-01-01T00:00:00.000Z' };
    for (let i = 0; i < 5; i++) community.writes.push({ userId: mockState.me.id, at: Date.now() - (i + 2) * 120_000 });
    renderWithApp(<App />, '/community/new');
    expect(await screen.findByRole('alert')).toHaveTextContent('글은 하루 5개까지 쓸 수 있어요');
  });

  it('429가 오면 쓰던 내용은 두고 사유를 보여줌', async () => {
    await seedLogin('user@devfeed.dev');
    const availableAt = new Date(Date.now() + 30_000).toISOString();
    server.use(
      http.post('*/api/community/posts', () =>
        HttpResponse.json({ code: 'POST_WRITE_LIMITED', message: 'x', reason: 'COOLDOWN', retryAfterSec: 30, availableAt }, { status: 429 }),
      ),
    );
    const user = userEvent.setup();
    renderWithApp(<App />, '/community/new');
    await fill(user, '제한 걸릴 글', '본문 열 글자 넘게 씀');
    await user.click(await screen.findByRole('button', { name: '올리기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/1분에 하나씩/);
    expect(screen.getByLabelText('제목')).toHaveValue('제한 걸릴 글');
  });

  it('짧은 제목·본문은 올리지 않고 안내, Tab은 들여쓰기', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/community/new');
    await fill(user, '가', '짧음');
    await user.click(await screen.findByRole('button', { name: '올리기' }));
    expect(screen.getByText('제목은 2~100자로 입력해 주세요')).toBeInTheDocument();
    expect(screen.getByText('본문은 10~20,000자로 입력해 주세요')).toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: '본문' }) as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'a');
    await user.keyboard('{Tab}b');
    expect(textarea.value).toBe('a\tb');
  });

  it('쓰던 글은 임시 저장되고 다시 열면 복구 안내', async () => {
    await seedLogin('user@devfeed.dev');
    localStorage.clear();
    const user = userEvent.setup();
    const first = renderWithApp(<App />, '/community/new');
    await fill(user, '임시 저장 글', '저장될 본문이에요 열 글자');
    await waitFor(() => expect(localStorage.getItem('devfeed:community-draft:1:new')).toContain('임시 저장 글'), { timeout: 2500 });
    first.unmount();
    renderWithApp(<App />, '/community/new');
    expect(await screen.findByText('임시 저장한 내용을 불러왔어요')).toBeInTheDocument();
    expect(screen.getByLabelText('제목')).toHaveValue('임시 저장 글');
    await userEvent.setup().click(screen.getByRole('button', { name: '버리기' }));
    expect(screen.getByLabelText('제목')).toHaveValue('');
    expect(localStorage.getItem('devfeed:community-draft:1:new')).toBeNull();
  });

  it('수정은 바뀐 필드만 보내고 "수정됨" 표시', async () => {
    await seedLogin('user@devfeed.dev');
    let sent: Record<string, unknown> | null = null;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PATCH' && request.url.includes('/community/posts/')) sent = (await request.clone().json()) as Record<string, unknown>;
    });
    const user = userEvent.setup();
    renderWithApp(<App />, `/community/posts/${MY_POST_ID}/edit`);
    const title = await screen.findByLabelText('제목');
    await user.clear(title);
    await user.type(title, '고친 제목');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('heading', { level: 1, name: '고친 제목' })).toBeInTheDocument();
    expect(sent).toEqual({ title: '고친 제목' });
    expect(screen.getByText('· 수정됨')).toBeInTheDocument();
    server.events.removeAllListeners();
  });
});

describe('A-05 신고 관리', () => {
  it('대기·숨김 탭, 문제없음 처리하면 목록에서 빠지고 글이 다시 보임', async () => {
    await seedLogin('admin@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/admin/reports');
    const list = within(await screen.findByRole('list', { name: '신고 목록' }));
    expect(list.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByRole('tab', { name: '숨김' }));
    const hidden = within(await screen.findByRole('list', { name: '신고 목록' }));
    await waitFor(() => expect(hidden.getAllByText(/^(글|댓글) #/)).toHaveLength(1));
    expect(hidden.getByText('자동 숨김')).toBeInTheDocument();
    expect(hidden.getByText(/욕설·비방/)).toBeInTheDocument();
    await user.click(hidden.getByRole('button', { name: '숨김 해제' }));
    expect(await screen.findByText('숨긴 대상이 없어요')).toBeInTheDocument();
    expect(community.posts.get(5012)!.status).toBe('VISIBLE');
  });
});

describe('F-082 프로필·북마크 연동', () => {
  it('프로필 카드는 글·좋아요·댓글·읽은 글·북마크 5칸', async () => {
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/community');
    const card = within(await screen.findByTestId('profile-card'));
    const stats = within(card.getByRole('list', { name: '활동 수치' }));
    expect(stats.getAllByRole('listitem').map((li) => li.textContent?.replace(/^[\d,.]+[KM]?/, ''))).toEqual([
      '글',
      '좋아요',
      '댓글',
      '읽은 글',
      '북마크',
    ]);
    expect(stats.getAllByRole('listitem')[0].textContent).toBe('1글');
  });

  it('북마크한 커뮤니티 글은 북마크 목록에서 상세 링크로 보임', async () => {
    await seedLogin('user@devfeed.dev');
    mockState.bookmarks.set(SOLVED_POST_ID, new Date().toISOString());
    mockState.bookmarks.set(5012, new Date().toISOString());
    renderWithApp(<App />, '/me/bookmarks');
    const link = await screen.findByRole('link', { name: 'Kafka 컨슈머 랙이 계속 쌓여요' });
    expect(link).toHaveAttribute('href', `/community/posts/${SOLVED_POST_ID}`);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});
