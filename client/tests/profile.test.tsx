import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AVATAR_TONES, avatarInitial, avatarTone } from '@/lib/avatar';
import { GRADES, gradeOf, gradeProgress, nextGradeOf } from '@/lib/grades';
import { mockPosts } from '@/mocks/fixtures';
import { mockState } from '@/mocks/handlers';
import { server } from '@/mocks/node';
import { setScoreBase } from '@/mocks/profile';
import { BUSY_POST_ID } from '@/mocks/reactions';
import { renderWithApp, seedLogin } from './render';

const busy = mockPosts.find((p) => p.id === BUSY_POST_ID)!;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function card() {
  return within(await screen.findByTestId('profile-card'));
}

function stat(c: ReturnType<typeof within>, label: string) {
  const el = c.getByText(label, { selector: 'span' }).previousElementSibling as HTMLElement;
  return el.textContent;
}

describe('F-083 등급 계산', () => {
  it('경계값에서 등급이 바뀜', () => {
    const cases: [number, number][] = [
      [0, 1],
      [99, 1],
      [100, 2],
      [499, 2],
      [500, 3],
      [1999, 3],
      [2000, 4],
      [4999, 4],
      [5000, 5],
      [99999, 5],
    ];
    for (const [score, level] of cases) expect(gradeOf(score).level).toBe(level);
    expect(nextGradeOf(4999)?.name).toBe('Architect');
    expect(nextGradeOf(5000)).toBeNull();
    expect(GRADES.map((g) => g.name)).toEqual(['Hello World', 'Junior Dev', 'Senior Dev', 'Tech Lead', 'Architect']);
  });

  it('진행 막대는 현재 등급 시작점부터 다음 등급까지 비율', () => {
    expect(gradeProgress(500, 500, 2000)).toBe(0);
    expect(gradeProgress(1250, 500, 2000)).toBe(0.5);
    expect(gradeProgress(1999, 500, 2000)).toBeLessThan(1);
    expect(gradeProgress(7000, 5000, null)).toBe(1);
  });
});

describe('자동 아바타', () => {
  it('첫 글자를 쓰고 영문은 대문자', () => {
    expect(avatarInitial('yeonchan')).toBe('Y');
    expect(avatarInitial('백엔드곰')).toBe('백');
    expect(avatarInitial('  zed')).toBe('Z');
  });

  it('같은 닉네임은 같은 색, 모든 색은 글자 대비 4.5:1 이상', () => {
    expect(avatarTone('yeonchan')).toBe(avatarTone('yeonchan'));
    expect(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => avatarTone(n).bg)).size).toBeGreaterThan(2);
    for (const t of AVATAR_TONES) expect(contrast(t.bg, t.fg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('F-082 프로필 카드 (029)', () => {
  it('게스트는 로그인 안내 카드, 로그인·가입 링크는 현재 화면으로 돌아옴', async () => {
    renderWithApp(<App />, '/tech/popular?period=DAY');
    const guest = within(await screen.findByTestId('guest-card'));
    expect(guest.getByText('좋아요·댓글로 등급을 올려 보세요')).toBeInTheDocument();
    expect(guest.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login?redirect=%2Ftech%2Fpopular%3Fperiod%3DDAY');
    expect(guest.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/signup?redirect=%2Ftech%2Fpopular%3Fperiod%3DDAY');
    expect(screen.queryByTestId('profile-card')).toBeNull();
  });

  it('회원 카드: 닉네임·등급·진행·수치 4개, 읽은 글·북마크는 해당 화면 링크', async () => {
    await seedLogin('yeonchan@devfeed.dev');
    setScoreBase(1240);
    mockState.bookmarks.set(mockPosts[1].id, '2026-11-20T00:00:00Z');
    mockState.reads.set(mockPosts[2].id, '2026-11-20T00:00:00Z');
    mockState.reads.set(mockPosts[3].id, '2026-11-20T00:00:00Z');
    renderWithApp(<App />, '/');
    const c = await card();
    expect(c.getByRole('link', { name: 'yeonchan' })).toHaveAttribute('href', '/me/settings');
    expect(c.getByText('Senior Dev')).toBeInTheDocument();
    expect(c.getByText('다음 등급까지 760P')).toBeInTheDocument();
    expect(c.getByText('1,240 / 2,000P')).toBeInTheDocument();
    expect(c.getByRole('progressbar', { name: 'Tech Lead까지 진행률' })).toHaveAttribute('aria-valuenow', '49');
    expect(c.getByRole('link', { name: '읽은 글 2개 보기' })).toHaveAttribute('href', '/me/history');
    expect(c.getByRole('link', { name: '북마크 1개 보기' })).toHaveAttribute('href', '/me/bookmarks');
    expect(stat(c, '좋아요')).toBe('0');
    expect(stat(c, '댓글')).toBe('0');
  });

  it('경계값 500점은 Lv.3 진행 0%, 5000점은 최고 등급', async () => {
    await seedLogin('user@devfeed.dev');
    setScoreBase(500);
    const first = renderWithApp(<App />, '/');
    let c = await card();
    expect(c.getByText('Senior Dev')).toBeInTheDocument();
    expect(c.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(c.getByText('다음 등급까지 1,500P')).toBeInTheDocument();
    first.unmount();

    setScoreBase(5000);
    renderWithApp(<App />, '/');
    c = await card();
    expect(c.getByText('Architect')).toBeInTheDocument();
    expect(c.getByText('최고 등급이에요')).toBeInTheDocument();
    expect(c.getByText('5,000P')).toBeInTheDocument();
    expect(c.getByRole('progressbar', { name: '최고 등급' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('좋아요·북마크 직후 카드 수치와 점수가 다시 맞춰짐', async () => {
    await seedLogin('user@devfeed.dev');
    setScoreBase(98);
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const c = await card();
    expect(c.getByText('Hello World')).toBeInTheDocument();
    const item = within((await screen.findByRole('link', { name: busy.title })).closest('article')!.parentElement as HTMLElement);
    await waitFor(() => expect(item.getByRole('button', { name: /^좋아요/ })).toHaveAttribute('aria-pressed', 'false'));
    await user.click(item.getByRole('button', { name: /^좋아요/ }));
    await waitFor(() => expect(stat(c, '좋아요')).toBe('1'));
    expect(c.getByText('Junior Dev')).toBeInTheDocument();
    expect(c.getByText('100 / 500P')).toBeInTheDocument();

    await user.click(item.getByRole('button', { name: /북마크/ }));
    await waitFor(() => expect(c.getByRole('link', { name: '북마크 1개 보기' })).toBeInTheDocument());

    await user.click(item.getByRole('button', { name: /^좋아요/ }));
    await waitFor(() => expect(stat(c, '좋아요')).toBe('0'));
    expect(c.getByText('Hello World')).toBeInTheDocument();
  });

  it('글을 열면 읽은 글이 늘고, 읽은 기록을 지워도 점수는 그대로', async () => {
    await seedLogin('user@devfeed.dev');
    setScoreBase(10);
    const user = userEvent.setup();
    const opened = window.open;
    window.open = () => null;
    renderWithApp(<App />, '/');
    const c = await card();
    await user.click(await screen.findByRole('link', { name: busy.title }));
    await waitFor(() => expect(c.getByRole('link', { name: '읽은 글 1개 보기' })).toBeInTheDocument());
    expect(c.getByText('11 / 100P')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: busy.title }));
    await new Promise((r) => setTimeout(r, 50));
    expect(c.getByText('11 / 100P')).toBeInTheDocument();
    window.open = opened;

    await user.click(c.getByRole('link', { name: '읽은 글 1개 보기' }));
    await user.click(await screen.findByRole('button', { name: new RegExp(`${busy.title}.*삭제|기록 삭제`) }));
    await waitFor(() => expect(mockState.reads.size).toBe(0));
  });

  it('댓글을 남기면 댓글 수가 늘고, 작성자 옆에 아바타·등급 배지가 보임', async () => {
    await seedLogin('user@devfeed.dev');
    setScoreBase(0);
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const c = await card();
    const item = within((await screen.findByRole('link', { name: busy.title })).closest('article')!.parentElement as HTMLElement);
    await waitFor(() => expect(item.getByRole('button', { name: /^댓글 \d+개$/ })).toBeInTheDocument());
    await user.click(item.getByRole('button', { name: /^댓글 \d+개$/ }));
    const region = within(await item.findByRole('region', { name: '댓글' }));
    await region.findByText(/리밸런싱 시간 줄이는 설정/);
    expect(region.getAllByTestId('avatar').length).toBeGreaterThan(0);
    expect(region.getAllByText(/^Lv\.\d$/).length).toBeGreaterThan(0);

    await user.type(region.getByRole('textbox', { name: '댓글 입력' }), '등급 올려 봐요');
    await user.click(region.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(stat(c, '댓글')).toBe('1'));
    expect(c.getByText('5 / 100P')).toBeInTheDocument();
    const mine = (await region.findByText('등급 올려 봐요')).closest('div.py-2\\.5') as HTMLElement;
    expect(within(mine).getByText('Hello World')).toBeInTheDocument();
  });

  it('등급 안내 모달에 등급표와 점수 규칙을 보여 줌', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const c = await card();
    await user.click(c.getByRole('button', { name: '등급 안내' }));
    const dialog = within(await screen.findByRole('dialog', { name: '등급 안내' }));
    for (const g of GRADES) expect(dialog.getByText(g.name)).toBeInTheDocument();
    expect(dialog.getByText('5,000점')).toBeInTheDocument();
    expect(dialog.getByText('같은 글은 처음 한 번만, 하루 최대 30점')).toBeInTheDocument();
    expect(dialog.getByText('점수에는 들어가지 않아요')).toBeInTheDocument();
    expect(dialog.getByRole('heading', { name: '등급' })).toBeInTheDocument();
    expect(dialog.getByRole('heading', { name: '점수 얻는 법' })).toBeInTheDocument();
    const panel = screen.getByRole('dialog', { name: '등급 안내' });
    expect(panel).toHaveClass('max-w-md');
    expect(panel.lastElementChild).toHaveClass('overflow-y-auto');
    expect(panel.querySelector('.break-keep')).not.toBeNull();
  });

  it.each(['/popular', '/for-you', '/search?q=kafka', '/security'])('%s 좌측 열 맨 위에도 카드가 있음', async (path) => {
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, path);
    const c = await screen.findByTestId('profile-card');
    const aside = c.closest('aside')!;
    expect(aside.firstElementChild).toBe(c);
  });

  it('헤더 프로필 메뉴 맨 위에 아바타·닉네임·등급 한 줄 (모바일용)', async () => {
    await seedLogin('user@devfeed.dev');
    setScoreBase(2000);
    renderWithApp(<App />, '/me/settings');
    const line = within(await screen.findByTestId('menu-profile'));
    expect(line.getByText('user')).toBeInTheDocument();
    expect(line.getByText('Tech Lead')).toBeInTheDocument();
  });

  it('프로필 요청이 실패하면 다시 시도할 수 있음', async () => {
    await seedLogin('user@devfeed.dev');
    let fail = true;
    server.use(
      http.get('*/api/me/profile', () =>
        fail ? HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 }) : undefined,
      ),
    );
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    await user.click(await screen.findByRole('button', { name: '다시 시도' }));
    fail = false;
    await user.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByTestId('profile-card')).toBeInTheDocument();
  });
});
