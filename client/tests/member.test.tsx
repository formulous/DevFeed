import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { validateSignup } from '@/features/auth/SignupPage';
import { groupByDate } from '@/features/me/HistoryPage';
import { mockPosts } from '@/mocks/fixtures';
import { mockState, TAKEN_EMAIL } from '@/mocks/handlers';
import { server } from '@/mocks/node';
import { currentLocation, renderWithApp, seedLogin } from './render';

const iso = (daysAgo: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe('S-06 회원가입', () => {
  it('입력 규칙을 검사함', () => {
    const errors = validateSignup({ email: 'x', password: 'abcdefgh', nickname: 'a' });
    expect(errors).toEqual({
      email: '이메일 형식이 아니에요',
      password: '영문과 숫자를 모두 넣어 주세요',
      nickname: '닉네임은 2~20자로 입력해 주세요',
    });
    expect(validateSignup({ email: 'a@b.co', password: 'abcd1234', nickname: '지훈' })).toEqual({});
    expect(validateSignup({ email: 'a@b.co', password: 'abcd 1234', nickname: '지훈' }).password).toBe(
      '공백과 한글은 쓸 수 없어요',
    );
    expect(validateSignup({ email: 'a@b.co', password: '비번abcd1234', nickname: '지훈' }).password).toBe(
      '공백과 한글은 쓸 수 없어요',
    );
  });

  async function fill(user: ReturnType<typeof userEvent.setup>, email: string) {
    await user.type(await screen.findByLabelText('이메일'), email);
    await user.type(screen.getByLabelText('비밀번호'), 'abcd1234');
    await user.type(screen.getByLabelText('닉네임'), '지훈');
    await user.click(screen.getByRole('button', { name: '가입하기' }));
  }

  it('중복 이메일은 이메일 필드 아래에 표시함', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/signup');
    await fill(user, TAKEN_EMAIL);
    expect(await screen.findByText('이미 가입된 이메일이에요')).toBeInTheDocument();
  });

  it('가입하면 온보딩으로 이동함', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/signup');
    await fill(user, 'new@devfeed.dev');
    await waitFor(() => expect(currentLocation).toBe('/onboarding/tags'));
  });
});

describe('S-07 온보딩', () => {
  it('3개 이상 골라야 완료할 수 있고, 완료하면 추천 피드로 이동함', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/onboarding/tags');
    const list = await screen.findByRole('list', { name: '태그 목록' });
    const done = screen.getByRole('button', { name: '완료' });
    for (const name of ['Kafka', 'React']) await user.click(within(list).getByRole('button', { name }));
    expect(done).toBeDisabled();
    await user.click(within(list).getByRole('button', { name: 'Redis' }));
    expect(screen.getByText('선택 3/10')).toBeInTheDocument();
    await user.click(done);
    await waitFor(() => expect(currentLocation).toBe('/tech/for-you'));
    expect(mockState.interestTags).toHaveLength(3);
    expect(mockState.me?.onboardingCompleted).toBe(true);
  });

  it('분류 탭과 검색으로 태그를 좁힘', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/onboarding/tags');
    const list = await screen.findByRole('list', { name: '태그 목록' });
    await user.click(screen.getByRole('tab', { name: 'Mobile' }));
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Swift', 'Flutter']));
    expect(within(list).queryByRole('button', { name: 'Kafka' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '전체' }));
    await user.type(screen.getByLabelText('태그 검색'), 'kaf');
    expect(within(list).getAllByRole('button')).toHaveLength(1);
  });

  it('건너뛰면 redirect로 이동함', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/onboarding/tags?redirect=%2Fpopular');
    await user.click(await screen.findByRole('button', { name: '건너뛰기' }));
    await waitFor(() => expect(currentLocation).toBe('/popular'));
    expect(mockState.me?.onboardingCompleted).toBe(true);
  });
});

describe('S-08 북마크', () => {
  it('총 건수와 저장일을 보여주고 태그로 거름', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    const [a, b, c] = mockPosts;
    mockState.bookmarks.set(a.id, iso(0)).set(b.id, iso(1)).set(c.id, iso(2));
    renderWithApp(<App />, '/me/bookmarks');
    expect(await screen.findByText('(3)')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getAllByText(/^저장 /)).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /^태그/ }));
    const dialog = screen.getByRole('dialog', { name: '태그 선택' });
    await user.type(within(dialog).getByLabelText('태그 검색'), a.tags[0].name);
    await user.click(within(dialog).getByRole('button', { name: new RegExp(`^${a.tags[0].name}`) }));
    expect(currentLocation).toBe('/me/bookmarks');
    await user.click(within(dialog).getByRole('button', { name: '적용' }));
    await waitFor(() => expect(currentLocation).toBe(`/me/bookmarks?tagIds=${a.tags[0].id}`));
    await waitFor(() =>
      screen.getAllByRole('article').forEach((el) => expect(el).toHaveTextContent(`#${a.tags[0].name}`)),
    );
    expect(within(screen.getByLabelText('적용된 필터')).getByText(a.tags[0].name)).toBeInTheDocument();
    await user.click(within(screen.getByLabelText('적용된 필터')).getByRole('button', { name: '초기화' }));
    await waitFor(() => expect(currentLocation).toBe('/me/bookmarks'));
    expect(await screen.findAllByRole('article')).toHaveLength(3);
  });

  it('태그 여러 개는 OR로 거르고, 예전 tagId 링크도 읽음', async () => {
    const { parseBookmarkTagIds } = await import('@/features/me/BookmarksPage');
    expect(parseBookmarkTagIds(new URLSearchParams('tagId=7'))).toEqual([7]);
    expect(parseBookmarkTagIds(new URLSearchParams('tagIds=3,x,3,5'))).toEqual([3, 5]);
    await seedLogin('user@devfeed.dev');
    const [a, b, c] = mockPosts;
    mockState.bookmarks.set(a.id, iso(0)).set(b.id, iso(1)).set(c.id, iso(2));
    const ids = [a.tags[0].id, b.tags[0].id];
    renderWithApp(<App />, `/me/bookmarks?tagIds=${ids.join(',')}`);
    await waitFor(() =>
      screen
        .getAllByRole('article')
        .forEach((el) => expect(el.textContent).toMatch(new RegExp(`#(${a.tags[0].name}|${b.tags[0].name})`))),
    );
    expect(screen.getByRole('button', { name: /^태그\s*2/ })).toBeInTheDocument();
  });

  it('북마크 한도 초과면 되돌리고 안내함', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    server.use(
      http.put('*/api/me/bookmarks/:id', () =>
        HttpResponse.json({ code: 'BOOKMARK_LIMIT_EXCEEDED', message: '한도' }, { status: 422 }),
      ),
    );
    renderWithApp(<App />, '/');
    await screen.findAllByRole('article');
    await user.click(screen.getAllByRole('button', { name: '북마크' })[0]);
    expect(await screen.findByText('북마크는 최대 5,000개까지 저장할 수 있어요')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('button', { name: '북마크' })[0]).toHaveAttribute('aria-pressed', 'false'));
  });
});

describe('S-09 읽은 기록', () => {
  it('날짜별로 묶음', () => {
    const p = mockPosts[0];
    const groups = groupByDate([
      { ...p, id: 1, readAt: iso(0, 10) },
      { ...p, id: 2, readAt: iso(0, 8) },
      { ...p, id: 3, readAt: iso(1) },
    ]);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
  });

  it('개별 삭제와 전체 삭제(확인 모달)', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    const [a, b, c] = mockPosts;
    mockState.reads.set(a.id, iso(0)).set(b.id, iso(0, 9)).set(c.id, iso(3));
    renderWithApp(<App />, '/me/history');
    expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: `${a.title} 기록 삭제` }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    expect(mockState.reads.has(a.id)).toBe(false);

    await user.click(screen.getByRole('button', { name: '전체 삭제' }));
    const dialog = screen.getByRole('dialog', { name: '읽은 기록 전체 삭제' });
    await user.click(within(dialog).getByRole('button', { name: '전체 삭제' }));
    expect(await screen.findByText('읽은 기록이 없어요')).toBeInTheDocument();
    expect(mockState.reads.size).toBe(0);
  });
});

describe('S-10 설정', () => {
  it('닉네임을 바꾸면 헤더에도 반영함', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/me/settings');
    const input = await screen.findByLabelText('닉네임');
    await user.clear(input);
    await user.type(input, '수민');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('수민 ▾')).toBeInTheDocument();
  });

  it('관심 태그가 3개면 더 뺄 수 없음', async () => {
    await seedLogin('user@devfeed.dev');
    mockState.interestTags = [1, 2, 3];
    renderWithApp(<App />, '/me/settings');
    const buttons = await within(await screen.findByRole('list', { name: '관심 태그' })).findAllByRole('button', {
      name: /관심 태그 제거$/,
    });
    expect(buttons).toHaveLength(3);
    buttons.forEach((b) => expect(b).toBeDisabled());
    expect(buttons[0]).toHaveAttribute('title', '최소 3개가 필요해요');
  });

  it('관심 태그가 4개면 하나 빼서 저장함', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    mockState.interestTags = [1, 2, 3, 4];
    renderWithApp(<App />, '/me/settings');
    const list = await screen.findByRole('list', { name: '관심 태그' });
    const remove = await within(list).findAllByRole('button', { name: /관심 태그 제거$/ });
    await user.click(remove[0]);
    await waitFor(() => expect(mockState.interestTags).toHaveLength(3));
  });

  it('탈퇴: 비밀번호가 틀리면 안내, 맞으면 게스트로 홈 이동', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/me/settings');
    await user.click(await screen.findByRole('button', { name: '회원 탈퇴' }));
    const dialog = screen.getByRole('dialog', { name: '회원 탈퇴' });
    expect(within(dialog).getByText('북마크, 읽은 기록, 관심 태그')).toBeInTheDocument();
    const pw = within(dialog).getByLabelText('비밀번호 확인');
    await user.type(pw, 'nope');
    await user.click(within(dialog).getByRole('button', { name: '탈퇴하기' }));
    expect(await within(dialog).findByText('비밀번호가 맞지 않아요')).toBeInTheDocument();

    await user.clear(pw);
    await user.type(pw, 'pw');
    await user.click(within(dialog).getByRole('button', { name: '탈퇴하기' }));
    await waitFor(() => expect(currentLocation).toBe('/tech'));
    expect(await within(screen.getByRole('banner')).findByRole('link', { name: '로그인' })).toBeInTheDocument();
    expect(mockState.me).toBeNull();
  });
});

describe('Modal', () => {
  it('부모가 다시 렌더링돼도 입력 포커스를 뺏지 않음', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/me/settings');
    await user.click(await screen.findByRole('button', { name: '회원 탈퇴' }));
    const pw = within(screen.getByRole('dialog', { name: '회원 탈퇴' })).getByLabelText('비밀번호 확인');
    await user.type(pw, 'abc123');
    expect(pw).toHaveValue('abc123');
    expect(pw).toHaveFocus();
  });
});

describe('로그아웃 후 이동', () => {
  it('회원 화면에서 로그아웃하면 로그인 화면이 아니라 홈으로 감', async () => {
    const user = userEvent.setup();
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/me/settings');
    await screen.findByRole('button', { name: '회원 탈퇴' });
    await user.click(screen.getAllByRole('button', { name: '로그아웃' }).at(-1)!);
    await waitFor(() => expect(currentLocation).toBe('/tech'));
  });
});
