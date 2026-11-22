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

const sub = () => within(screen.getByTestId('section-tabs'));

describe('F-015 상단 탭 (031: 기술 뉴스·보안 뉴스 + 내부 탭)', () => {
  it('1단 탭은 자유 게시판·기술 뉴스·보안 뉴스 3개, 내부 탭 화면에서도 해당 1단 탭이 선택됨', async () => {
    renderWithApp(<App />, '/tech/popular');
    await screen.findByRole('list', { name: '인기 글 순위' });
    expect(nav().getAllByRole('link').map((l) => l.textContent)).toEqual(['자유 게시판', '기술 뉴스', '보안 뉴스']);
    expect(nav().getByRole('link', { name: '자유 게시판' })).toHaveAttribute('href', '/community');
    expect(nav().getByRole('link', { name: '기술 뉴스' })).toHaveAttribute('aria-current', 'page');
    expect(nav().getByRole('link', { name: '기술 뉴스' })).toHaveAttribute('href', '/tech');
    expect(nav().getByRole('link', { name: '보안 뉴스' })).toHaveAttribute('href', '/security');
    expect(screen.getByRole('heading', { level: 1, name: '기술 뉴스' })).toBeInTheDocument();
    expect(sub().getByRole('link', { name: '인기' })).toHaveAttribute('aria-current', 'page');
  });

  it('기술 뉴스 내부 탭은 최신·추천·인기·댓글, 보안 뉴스는 최신·인기', async () => {
    const first = renderWithApp(<App />, '/tech');
    await screen.findAllByRole('article');
    expect([...screen.getByTestId('section-tabs').querySelectorAll('a, button')].map((l) => l.textContent)).toEqual(['최신', '추천', '인기', '댓글']);
    first.unmount();
    renderWithApp(<App />, '/security');
    expect(sub().getAllByRole('link').map((l) => l.textContent)).toEqual(['최신', '인기']);
    expect(screen.getByRole('heading', { level: 1, name: '보안 뉴스' })).toBeInTheDocument();
    expect(nav().getByRole('link', { name: '보안 뉴스' })).toHaveAttribute('aria-current', 'page');
  });

  it('게스트가 추천을 누르면 로그인 안내만 뜨고 이동하지 않음', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech');
    await screen.findAllByRole('article');
    await waitFor(() => expect(sub().getByRole('button', { name: '추천' })).toBeInTheDocument());
    await user.click(sub().getByRole('button', { name: '추천' }));
    expect(await screen.findByText('추천 글을 보려면 로그인이 필요해요')).toBeInTheDocument();
    expect(currentLocation).toBe('/tech');
  });

  it('게스트가 /tech/for-you로 바로 들어오면 로그인 화면으로 가고 돌아올 주소를 유지함', async () => {
    renderWithApp(<App />, '/tech/for-you');
    await waitFor(() => expect(currentLocation).toBe('/login?redirect=%2Ftech%2Ffor-you'));
  });

  it('회원은 추천 내부 탭으로 추천 피드에 감', async () => {
    await seedLogin('user@devfeed.dev');
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech?field=ai');
    await waitFor(() => expect(sub().getByRole('link', { name: '추천' })).toHaveAttribute('href', '/tech/for-you?field=ai'));
    await user.click(sub().getByRole('link', { name: '추천' }));
    await waitFor(() => expect(currentLocation).toBe('/tech/for-you?field=ai'));
    expect(await screen.findByRole('region', { name: '추천 피드' })).toBeInTheDocument();
    expect(fieldGroup()).toBeNull();
  });

  it.each([
    ['/', '/tech'],
    ['/?field=ai&tagIds=3', '/tech?field=ai&tagIds=3'],
    ['/for-you', '/login?redirect=%2Ftech%2Ffor-you'],
    ['/popular?field=mobile&period=DAY', '/tech/popular?field=mobile&period=DAY'],
    ['/company?field=backend', '/tech?field=backend&sourceType=COMPANY'],
    ['/personal', '/tech?sourceType=PERSONAL'],
  ])('옛 주소 %s 는 %s 로 넘어감', async (from, to) => {
    renderWithApp(<App />, from);
    await waitFor(() => expect(currentLocation).toBe(to));
  });

  it('보안 뉴스 내부 탭 이동 시 지역·출처를 유지함', async () => {
    renderWithApp(<App />, '/security?region=domestic&sourceIds=901');
    await waitFor(() =>
      expect(sub().getByRole('link', { name: '인기' })).toHaveAttribute('href', '/security/popular?region=domestic&sourceIds=901'),
    );
  });

  it('분야 탭은 최신·인기에서만 보임', async () => {
    for (const path of ['/tech', '/tech/popular']) {
      const { unmount } = renderWithApp(<App />, path);
      expect(fieldGroup()).not.toBeNull();
      unmount();
    }
    for (const path of ['/tech/for-you', '/security', '/security/popular', '/search?q=react', '/privacy']) {
      const { unmount } = renderWithApp(<App />, path);
      expect(fieldGroup()).toBeNull();
      unmount();
    }
  });

  it('분야 탭은 영어 표기, BE·FE는 풀네임 라벨·툴팁', () => {
    renderWithApp(<App />, '/tech');
    const radios = within(fieldGroup()!).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['전체', 'BE', 'FE', 'AI', 'Data', 'Infra', 'Mobile', 'Security']);
    const be = within(fieldGroup()!).getByRole('radio', { name: 'Backend' });
    expect(be).toHaveTextContent('BE');
    expect(be).toHaveAttribute('title', 'Backend');
    expect(within(fieldGroup()!).getByRole('radio', { name: 'Frontend' })).toHaveTextContent('FE');
  });

  it('분야를 고르면 URL에 반영하고 해당 분류 태그 글만 보여줌, 내부 탭을 옮겨도 분야는 유지·태그 필터는 초기화', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech?tagIds=1');
    await screen.findAllByRole('article');
    await user.click(within(fieldGroup()!).getByRole('radio', { name: 'Frontend' }));
    await waitFor(() => expect(currentLocation).toBe('/tech?tagIds=1&field=frontend'));
    const allowed = tagNamesOf(['Frontend', 'Design']);
    await waitFor(() => {
      const empty = screen.queryByText('조건에 맞는 글이 없어요');
      if (empty) return;
      const articles = screen.getAllByRole('article');
      expect(articles.every((a) => allowed.some((n) => a.textContent?.includes(`#${n}`)))).toBe(true);
    });
    expect(sub().getByRole('link', { name: '인기' })).toHaveAttribute('href', '/tech/popular?field=frontend');
    await user.click(sub().getByRole('link', { name: '인기' }));
    await waitFor(() => expect(currentLocation).toBe('/tech/popular?field=frontend'));
    expect(within(fieldGroup()!).getByRole('radio', { name: 'Frontend' })).toHaveAttribute('aria-checked', 'true');
  });

  it('잘못된 분야 값은 전체로 해석함', () => {
    expect(parseField('cooking')).toBeNull();
    expect(parseFeedFilters(new URLSearchParams('field=ai')).field).toBe('AI');
    expect(parseFeedFilters(new URLSearchParams('field=AI')).field).toBeNull();
  });

  it('인기 탭에 분야를 적용함', async () => {
    renderWithApp(<App />, '/tech/popular?field=mobile');
    expect(await screen.findByRole('heading', { name: /인기 글 · Mobile/ })).toBeInTheDocument();
    const allowed = tagNamesOf(['Mobile']);
    const ranking = await screen.findByRole('list', { name: '인기 글 순위' });
    const articles = within(ranking).getAllByRole('article');
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((a) => allowed.some((n) => a.textContent?.includes(`#${n}`)))).toBe(true);
    expect(mockPosts.length).toBeGreaterThan(articles.length);
  });
});
