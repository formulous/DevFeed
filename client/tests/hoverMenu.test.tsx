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

describe('033 데스크톱 펼침 메뉴·정렬 선택', () => {
  it('1단 탭 순서는 자유 게시판·기술 뉴스·보안 뉴스, 토글 그룹 대신 정렬 선택이 현재 하위 탭을 보여줌', async () => {
    renderWithApp(<App />, '/tech/popular?field=ai');
    await screen.findByRole('list', { name: '인기 글 순위' });
    expect(nav().getAllByRole('link').map((l) => l.textContent)).toEqual(['자유 게시판', '기술 뉴스', '보안 뉴스']);
    expect(screen.queryByTestId('section-tabs')).toBeNull();
    expect(screen.getByRole('button', { name: '정렬: 인기순' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '분야' })).toBeInTheDocument();
  });

  it('1단 탭에 마우스를 올리면 하위 메뉴가 펼쳐지고, 항목을 누르면 이동하며 유지 규칙을 따름', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech?field=backend&tagIds=1');
    await screen.findAllByRole('article');
    await user.hover(screen.getByTestId('section-menu-tech'));
    const menu = within(await screen.findByRole('menu', { name: '기술 뉴스 보기' }));
    expect(menu.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['최신', '추천', '인기']);
    expect(menu.getByRole('menuitem', { name: '최신' })).toHaveAttribute('aria-current', 'page');
    await user.click(menu.getByRole('menuitem', { name: '인기' }));
    expect(currentLocation).toBe('/tech/popular?field=backend');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    await user.hover(screen.getByTestId('section-menu-community'));
    const cm = within(await screen.findByRole('menu', { name: '자유 게시판 보기' }));
    expect(cm.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['최신', '인기']);
    await user.unhover(screen.getByTestId('section-menu-community'));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('비회원이 메뉴·정렬에서 추천을 고르면 로그인 안내만 뜸', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech');
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: '정렬: 최신순' }));
    const menu = within(await screen.findByRole('menu', { name: '정렬' }));
    expect(menu.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['최신순', '추천순', '인기순']);
    await user.click(menu.getByRole('menuitem', { name: '추천순' }));
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
    expect(screen.getByRole('menuitem', { name: '인기' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: '기술 뉴스 보기' })).toBeNull();
    expect(tech).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: '최신' })).toHaveFocus());
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(currentLocation).toBe('/tech/for-you'));
  });

  it('자유 게시판은 글쓰기 버튼이 정렬 선택 왼쪽, 정렬을 바꾸면 말머리를 유지하고 이동', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/community?category=question');
    await screen.findAllByRole('article');
    const sort = screen.getByTestId('sort-select');
    const write = screen.getAllByRole('button', { name: '글쓰기' })[0];
    expect(write.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(within(sort).getByRole('button', { name: '정렬: 최신순' }));
    await user.click(await screen.findByRole('menuitem', { name: '인기순' }));
    expect(currentLocation).toBe('/community/popular?category=question');
    expect(await screen.findByRole('button', { name: '정렬: 인기순' })).toBeInTheDocument();
  });
});
