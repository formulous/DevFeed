import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { parseFeedFilters } from '@/hooks/useFeedFilters';
import { parseField } from '@/lib/fields';
import { mockPosts, mockSources, mockTags } from '@/mocks/fixtures';
import { currentLocation, renderWithApp } from './render';

const nav = () => within(screen.getByRole('navigation', { name: '피드' }));
const fieldGroup = () => screen.queryByRole('radiogroup', { name: '분야' });
const tagNamesOf = (categories: string[]) => mockTags.filter((t) => t.category && categories.includes(t.category)).map((t) => t.name);

describe('F-015 상단 탭', () => {
  it('1단 탭 6개를 보여주고 현재 탭을 표시함', async () => {
    renderWithApp(<App />, '/company');
    const links = nav().getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['최신', '추천', '인기', '기업 블로그', '개인 블로그', '보안 뉴스']);
    expect(nav().getByRole('link', { name: '기업 블로그' })).toHaveAttribute('aria-current', 'page');
    expect(nav().getByRole('link', { name: '최신' })).not.toHaveAttribute('aria-current');
  });

  it('분야 탭은 최신·인기·기업·개인에서만 보임', async () => {
    for (const path of ['/', '/popular', '/company', '/personal']) {
      const { unmount } = renderWithApp(<App />, path);
      expect(fieldGroup()).not.toBeNull();
      unmount();
    }
    for (const path of ['/security', '/search?q=react', '/privacy']) {
      const { unmount } = renderWithApp(<App />, path);
      expect(fieldGroup()).toBeNull();
      unmount();
    }
  });

  it('분야를 고르면 URL에 반영하고 해당 분류 태그 글만 보여줌, 다른 탭으로 가도 분야 유지', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/?tagIds=1');
    await screen.findAllByRole('article');
    await user.click(within(fieldGroup()!).getByRole('radio', { name: '프론트엔드' }));
    await waitFor(() => expect(currentLocation).toBe('/?tagIds=1&field=frontend'));
    const allowed = tagNamesOf(['프론트엔드', '디자인']);
    await waitFor(() => {
      const empty = screen.queryByText('조건에 맞는 글이 없음');
      if (empty) return;
      const articles = screen.getAllByRole('article');
      expect(articles.every((a) => allowed.some((n) => a.textContent?.includes(`#${n}`)))).toBe(true);
    });
    expect(nav().getByRole('link', { name: '인기' })).toHaveAttribute('href', '/popular?field=frontend');
    expect(nav().getByRole('link', { name: '추천' })).toHaveAttribute('href', '/for-you');
    await user.click(nav().getByRole('link', { name: '기업 블로그' }));
    await waitFor(() => expect(currentLocation).toBe('/company?field=frontend'));
    expect(within(fieldGroup()!).getByRole('radio', { name: '프론트엔드' })).toHaveAttribute('aria-checked', 'true');
  });

  it('잘못된 분야 값은 전체로 해석함', () => {
    expect(parseField('cooking')).toBeNull();
    expect(parseFeedFilters(new URLSearchParams('field=ai')).field).toBe('AI');
    expect(parseFeedFilters(new URLSearchParams('field=AI')).field).toBeNull();
  });
});

describe('S-13 기업·개인 블로그 탭', () => {
  it('기업 탭은 기업 소스 글만, 유형 세그먼트 없음, URL sourceType은 무시함', async () => {
    renderWithApp(<App />, '/personal?sourceType=COMPANY');
    const region = await screen.findByRole('region', { name: '개인 블로그 피드' });
    const personal = mockSources.filter((s) => s.type === 'PERSONAL').map((s) => s.name);
    await waitFor(() => {
      const articles = within(region).getAllByRole('article');
      expect(articles.every((a) => personal.some((n) => a.textContent?.includes(n)))).toBe(true);
    });
    expect(screen.queryByRole('radiogroup', { name: '소스 유형' })).toBeNull();
  });

  it('소스 선택 창에는 해당 유형 소스만 나옴', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/company');
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: '소스 전체 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '소스 선택' });
    expect(within(dialog).queryByRole('tablist')).toBeNull();
    expect(within(dialog).queryByText('개발자 김씨 블로그')).toBeNull();
    expect(within(dialog).getByText('토스 기술블로그')).toBeInTheDocument();
  });

  it('인기 탭에 분야를 적용함', async () => {
    renderWithApp(<App />, '/popular?field=mobile');
    expect(await screen.findByRole('heading', { name: /인기 글 · 모바일/ })).toBeInTheDocument();
    const allowed = tagNamesOf(['모바일']);
    const ranking = await screen.findByRole('list', { name: '인기 글 순위' });
    const articles = within(ranking).getAllByRole('article');
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((a) => allowed.some((n) => a.textContent?.includes(`#${n}`)))).toBe(true);
    expect(mockPosts.length).toBeGreaterThan(articles.length);
  });
});
