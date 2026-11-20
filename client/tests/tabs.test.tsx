import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { parseFeedFilters } from '@/hooks/useFeedFilters';
import { parseField } from '@/lib/fields';
import { mockPosts, mockTags } from '@/mocks/fixtures';
import { categoryLabel } from '@/lib/categories';
import { currentLocation, renderWithApp, seedLogin } from './render';

const nav = () => within(screen.getByRole('navigation', { name: '피드' }));
const fieldGroup = () => screen.queryByRole('radiogroup', { name: '분야' });
const tagNamesOf = (categories: string[]) =>
  mockTags.filter((t) => t.category && categories.includes(categoryLabel(t.category))).map((t) => t.name);

describe('F-015 상단 탭 (023)', () => {
  it('게스트는 최신·인기·보안 뉴스 3개, 추천 탭 없음', async () => {
    renderWithApp(<App />, '/popular');
    await screen.findByRole('list', { name: '인기 글 순위' });
    expect(nav().getAllByRole('link').map((l) => l.textContent)).toEqual(['최신', '인기', '보안 뉴스']);
    expect(nav().getByRole('link', { name: '인기' })).toHaveAttribute('aria-current', 'page');
  });

  it('회원은 추천 포함 4개', async () => {
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/');
    await waitFor(() =>
      expect(nav().getAllByRole('link').map((l) => l.textContent)).toEqual(['최신', '추천', '인기', '보안 뉴스']),
    );
  });

  it('로그인 상태 확인 중에는 추천 탭을 그리지 않음', () => {
    renderWithApp(<App />, '/');
    expect(nav().queryByRole('link', { name: '추천' })).toBeNull();
  });

  it('예전 /company·/personal 주소는 소스 유형 필터가 걸린 최신 피드로 이동하고 분야를 유지함', async () => {
    const { unmount } = renderWithApp(<App />, '/company?field=backend');
    await waitFor(() => expect(currentLocation).toBe('/?field=backend&sourceType=COMPANY'));
    unmount();
    renderWithApp(<App />, '/personal');
    await waitFor(() => expect(currentLocation).toBe('/?sourceType=PERSONAL'));
    expect(await screen.findByRole('radio', { name: '개인' })).toHaveAttribute('aria-checked', 'true');
  });

  it('분야 탭은 최신·인기에서만 보임', async () => {
    for (const path of ['/', '/popular']) {
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

  it('분야 탭은 영어 표기, BE·FE는 풀네임 라벨·툴팁', () => {
    renderWithApp(<App />, '/');
    const radios = within(fieldGroup()!).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['전체', 'BE', 'FE', 'AI', 'Data', 'Infra', 'Mobile', 'Security']);
    const be = within(fieldGroup()!).getByRole('radio', { name: 'Backend' });
    expect(be).toHaveTextContent('BE');
    expect(be).toHaveAttribute('title', 'Backend');
    expect(within(fieldGroup()!).getByRole('radio', { name: 'Frontend' })).toHaveTextContent('FE');
  });

  it('분야를 고르면 URL에 반영하고 해당 분류 태그 글만 보여줌, 다른 탭으로 가도 분야 유지', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/?tagIds=1');
    await screen.findAllByRole('article');
    await user.click(within(fieldGroup()!).getByRole('radio', { name: 'Frontend' }));
    await waitFor(() => expect(currentLocation).toBe('/?tagIds=1&field=frontend'));
    const allowed = tagNamesOf(['Frontend', 'Design']);
    await waitFor(() => {
      const empty = screen.queryByText('조건에 맞는 글이 없음');
      if (empty) return;
      const articles = screen.getAllByRole('article');
      expect(articles.every((a) => allowed.some((n) => a.textContent?.includes(`#${n}`)))).toBe(true);
    });
    expect(nav().getByRole('link', { name: '인기' })).toHaveAttribute('href', '/popular?field=frontend');
    await user.click(nav().getByRole('link', { name: '인기' }));
    await waitFor(() => expect(currentLocation).toBe('/popular?field=frontend'));
    expect(within(fieldGroup()!).getByRole('radio', { name: 'Frontend' })).toHaveAttribute('aria-checked', 'true');
  });

  it('잘못된 분야 값은 전체로 해석함', () => {
    expect(parseField('cooking')).toBeNull();
    expect(parseFeedFilters(new URLSearchParams('field=ai')).field).toBe('AI');
    expect(parseFeedFilters(new URLSearchParams('field=AI')).field).toBeNull();
  });

  it('인기 탭에 분야를 적용함', async () => {
    renderWithApp(<App />, '/popular?field=mobile');
    expect(await screen.findByRole('heading', { name: /인기 글 · Mobile/ })).toBeInTheDocument();
    const allowed = tagNamesOf(['Mobile']);
    const ranking = await screen.findByRole('list', { name: '인기 글 순위' });
    const articles = within(ranking).getAllByRole('article');
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((a) => allowed.some((n) => a.textContent?.includes(`#${n}`)))).toBe(true);
    expect(mockPosts.length).toBeGreaterThan(articles.length);
  });
});
