import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { currentLocation, renderWithApp, seedLogin } from './render';

const flags = globalThis as { __hoverMenu?: boolean };

beforeEach(() => {
  flags.__hoverMenu = true;
});

const nav = () => within(screen.getByRole('navigation', { name: '피드' }));
const sortTabs = () => within(screen.getByRole('navigation', { name: '정렬' }));
const sortLabels = () => [...screen.getByTestId('sort-tabs').querySelectorAll('a, button')].map((l) => l.textContent);
const metrics = () => screen.getAllByTestId('rank-metric').map((m) => Number(m.textContent!.replace(/\D/g, '')));

describe('033·035 데스크톱 펼침 메뉴·정렬 글자 탭', () => {
  it('1단 탭 순서는 자유 게시판·기술 뉴스·보안 뉴스, 토글 그룹·펼침 선택 대신 정렬 글자 탭이 현재 하위 탭을 보여줌', async () => {
    renderWithApp(<App />, '/tech/popular?field=ai');
    await screen.findByRole('list', { name: '인기 글 순위' });
    expect(nav().getAllByRole('link').map((l) => l.textContent)).toEqual(['자유 게시판', '기술 뉴스', '보안 뉴스']);
    expect(screen.queryByTestId('section-tabs')).toBeNull();
    expect(screen.queryByTestId('sort-select')).toBeNull();
    expect(sortLabels()).toEqual(['최신순', '추천순', '인기순', '댓글순']);
    expect(sortTabs().getByRole('link', { name: '인기순' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('radiogroup', { name: '분야' })).toBeInTheDocument();
  });

  it('1단 탭에 마우스를 올리면 하위 메뉴가 펼쳐지고, 항목을 누르면 이동하며 유지 규칙을 따름', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech?field=backend&tagIds=1');
    await screen.findAllByRole('article');
    await user.hover(screen.getByTestId('section-menu-tech'));
    const menu = within(await screen.findByRole('menu', { name: '기술 뉴스 보기' }));
    expect(menu.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['최신', '추천', '인기', '댓글']);
    expect(menu.getByRole('menuitem', { name: '최신' })).toHaveAttribute('aria-current', 'page');
    await user.click(menu.getByRole('menuitem', { name: '인기' }));
    expect(currentLocation).toBe('/tech/popular?field=backend');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    await user.hover(screen.getByTestId('section-menu-community'));
    const cm = within(await screen.findByRole('menu', { name: '자유 게시판 보기' }));
    expect(cm.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['최신', '인기', '댓글', '좋아요']);
    await user.unhover(screen.getByTestId('section-menu-community'));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    await user.hover(screen.getByTestId('section-menu-security'));
    const sm = within(await screen.findByRole('menu', { name: '보안 뉴스 보기' }));
    expect(sm.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['최신', '인기']);
  });

  it('비회원이 메뉴·정렬에서 추천을 고르면 로그인 안내만 뜸', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech');
    await screen.findAllByRole('article');
    await user.click(sortTabs().getByRole('button', { name: '추천순' }));
    expect(await screen.findByText('추천 글을 보려면 로그인이 필요해요')).toBeInTheDocument();
    expect(currentLocation).toBe('/tech');
  });

  it('키보드: 포커스로 펼침, ↓로 들어가 ↑↓ 이동, Esc로 닫고 탭으로 돌아감, Enter로 이동', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/security');
    await screen.findAllByRole('article');
    const tech = nav().getByRole('link', { name: '기술 뉴스' });
    act(() => tech.focus());
    expect(await screen.findByRole('menu', { name: '기술 뉴스 보기' })).toBeInTheDocument();
    expect(tech).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: '최신' })).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: '추천' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: '댓글' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: '기술 뉴스 보기' })).toBeNull();
    expect(tech).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: '최신' })).toHaveFocus());
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(currentLocation).toBe('/tech/for-you'));
  });

  it('자유 게시판: 정렬 글자 탭 오른쪽에 글쓰기, 말머리 유지, 인기·댓글·좋아요 사이에서만 기간 유지', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/community?category=question');
    await screen.findAllByRole('article');
    expect(sortLabels()).toEqual(['최신순', '인기순', '댓글순', '좋아요순']);
    const write = screen.getAllByRole('button', { name: '글쓰기' })[0];
    expect(screen.getByTestId('sort-tabs').compareDocumentPosition(write) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(sortTabs().getByRole('link', { name: '인기순' }));
    expect(currentLocation).toBe('/community/popular?category=question');
    await screen.findByRole('list', { name: '자유 게시판 인기 글 순위' });
    await user.click(screen.getByRole('radio', { name: '30일' }));
    await waitFor(() => expect(currentLocation).toBe('/community/popular?category=question&period=MONTH'));

    await user.click(sortTabs().getByRole('link', { name: '댓글순' }));
    expect(currentLocation).toBe('/community/comments?category=question&period=MONTH');
    await screen.findByRole('list', { name: '자유 게시판 댓글 많은 글 순위' });
    expect(screen.getByRole('radio', { name: '30일' })).toHaveAttribute('aria-checked', 'true');
    expect(sortTabs().getByRole('link', { name: '댓글순' })).toHaveAttribute('aria-current', 'page');

    await user.click(sortTabs().getByRole('link', { name: '좋아요순' }));
    expect(currentLocation).toBe('/community/likes?category=question&period=MONTH');
    await screen.findByRole('list', { name: '자유 게시판 좋아요 많은 글 순위' });

    await user.click(sortTabs().getByRole('link', { name: '최신순' }));
    expect(currentLocation).toBe('/community?category=question');
  });

  it('댓글순·좋아요순은 수치 내림차순이고 0건 글은 빠지며 해당 수치를 강조함', async () => {
    const first = renderWithApp(<App />, '/community/likes?period=MONTH');
    await screen.findByRole('list', { name: '자유 게시판 좋아요 많은 글 순위' });
    const likes = metrics();
    expect(likes.length).toBeGreaterThan(0);
    expect(likes.every((n) => n >= 1)).toBe(true);
    expect([...likes].sort((a, b) => b - a)).toEqual(likes);
    expect(screen.getAllByTestId('rank-metric')[0]).toHaveTextContent('좋아요');
    first.unmount();

    renderWithApp(<App />, '/tech/comments?period=MONTH');
    await screen.findByRole('list', { name: '댓글 많은 글 순위' });
    const comments = metrics();
    expect(comments.length).toBeGreaterThan(0);
    expect(comments.every((n) => n >= 1)).toBe(true);
    expect([...comments].sort((a, b) => b - a)).toEqual(comments);
    expect(screen.getByRole('heading', { level: 2, name: /댓글 많은 글/ })).toBeInTheDocument();
  });
});
