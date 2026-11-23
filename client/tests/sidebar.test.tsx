import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { currentLocation, renderWithApp } from './render';

const sidebar = () => within(screen.getByTestId('filter-sidebar'));

describe('017 필터 요약 패널', () => {
  it('인기 태그 12개 칩, 유형 세그먼트, 많이 쓰는 소스 5개를 보여주고 목록 스크롤이 없음', async () => {
    renderWithApp(<App />, '/');
    const tags = await sidebar().findByRole('region', { name: '태그 필터' });
    await waitFor(() => expect(within(tags).getAllByRole('button', { pressed: false })).toHaveLength(12));
    expect(sidebar().getByRole('radiogroup', { name: '소스 유형' })).toBeInTheDocument();
    const sources = sidebar().getByRole('region', { name: '소스 필터' });
    await waitFor(() => expect(within(sources).getAllByRole('button', { pressed: false })).toHaveLength(5));
    expect(screen.getByTestId('filter-sidebar').querySelectorAll('[class*="overflow-y-auto"] [class*="overflow-y-auto"]')).toHaveLength(0);
  });

  it('칩을 누르면 바로 적용되고, 상위 12개 밖의 선택 태그도 패널 앞에 보임', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/?tagIds=129');
    const tags = await sidebar().findByRole('region', { name: '태그 필터' });
    await within(tags).findByRole('button', { name: /^Kafka/ });
    const first = within(tags).getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))[0];
    expect(first).toHaveTextContent('Testing');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(tags).getByRole('button', { name: /^Kafka/ }));
    await waitFor(() => expect(currentLocation).toMatch(/tagIds=129%2C\d+|tagIds=129,\d+/));
    expect(screen.getByLabelText('적용된 필터')).toHaveTextContent('Kafka');
  });

  it('태그 선택 창: 검색·분류로 고르고 [적용]해야 반영됨', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    await user.click(await sidebar().findByRole('button', { name: '태그 전체 보기' }));
    const dialog = screen.getByRole('dialog', { name: '태그 선택' });
    expect(within(dialog).getByLabelText('태그 검색')).toHaveFocus();
    await user.click(within(dialog).getByRole('tab', { name: '기타' }));
    await user.click(within(dialog).getByRole('button', { name: /^Rust/ }));
    await user.type(within(dialog).getByLabelText('태그 검색'), 'kaf');
    await user.click(within(dialog).getByRole('tab', { name: '전체' }));
    await user.click(within(dialog).getByRole('button', { name: /^Kafka/ }));
    expect(within(dialog).getByText('선택 2/10')).toBeInTheDocument();
    expect(currentLocation).toBe('/tech');
    await user.click(within(dialog).getByRole('button', { name: '적용' }));
    await waitFor(() => expect(currentLocation).toMatch(/^\/tech\?tagIds=/));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('적용된 필터')).toHaveTextContent(/Rust.*Kafka|Kafka.*Rust/);
  });

  it('선택 창은 Esc로 닫히고 적용하지 않은 선택은 버림', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    await user.click(await sidebar().findByRole('button', { name: '소스 전체 보기' }));
    const dialog = screen.getByRole('dialog', { name: '소스 선택' });
    await user.click(within(dialog).getByRole('tab', { name: '개인' }));
    within(dialog)
      .getAllByRole('button', { pressed: false })
      .slice(0, 1)
      .forEach((b) => b.click());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentLocation).toBe('/tech');
  });

  it('선택 창 안에서 Tab 포커스가 맴돔', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    await user.click(await sidebar().findByRole('button', { name: '태그 전체 보기' }));
    const dialog = screen.getByRole('dialog', { name: '태그 선택' });
    const apply = within(dialog).getByRole('button', { name: '적용' });
    apply.focus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus();
  });

  it('모바일 버튼 줄: 다이얼로그 없이 페이지 안에 패널을 펼치고 한 번에 하나만 엶 (040)', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=%EC%A0%95%EB%A6%AC');
    const bar = await screen.findByLabelText('필터 열기');
    const period = within(bar).getByRole('button', { name: /^기간/ });
    expect(period).toHaveAttribute('aria-expanded', 'false');
    await user.click(period);
    expect(period).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: '기간 고르기' });
    expect(period).toHaveAttribute('aria-controls', panel.id);
    await user.click(within(panel).getByRole('radio', { name: '1주' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EC%A0%95%EB%A6%AC&period=1W'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: /^기간\s*1/ })).toBeInTheDocument();

    await user.click(within(bar).getByRole('button', { name: /^태그/ }));
    expect(screen.getByRole('region', { name: '태그 고르기' })).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: /^소스/ }));
    expect(screen.queryByRole('region', { name: '태그 고르기' })).toBeNull();
    expect(screen.getByRole('region', { name: '소스 고르기' })).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: /^소스/ }));
    expect(screen.queryByTestId('inline-picker')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('펼침 패널 칩은 바로 적용(300ms 모아서), 검색·더 보기·초기화·접기 (040)', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech');
    const bar = await screen.findByLabelText('필터 열기');
    await user.click(within(bar).getByRole('button', { name: /^태그/ }));
    const panel = screen.getByRole('region', { name: '태그 고르기' });
    const chips = await within(panel).findAllByRole('button', { pressed: false });
    expect(chips.length).toBeLessThanOrEqual(20);
    await user.click(chips[0]);
    await user.click(chips[1]);
    expect(currentLocation).toBe('/tech');
    await waitFor(() => expect(currentLocation).toMatch(/^\/tech\?tagIds=\d+%2C\d+$|^\/tech\?tagIds=\d+,\d+$/));
    expect(within(panel).getByText('선택 2/10')).toBeInTheDocument();
    expect(screen.getByLabelText('적용된 필터')).toBeInTheDocument();

    await user.type(within(panel).getByRole('searchbox', { name: '태그 검색' }), 'zzzz');
    expect(within(panel).getByText('일치하는 태그가 없어요')).toBeInTheDocument();
    await user.clear(within(panel).getByRole('searchbox', { name: '태그 검색' }));
    const more = within(panel).queryByRole('button', { name: '더 보기 ›' });
    if (more) {
      await user.click(more);
      expect(within(panel).getByRole('tablist', { name: '분류' })).toBeInTheDocument();
    }
    await user.click(within(panel).getByRole('button', { name: '초기화' }));
    await waitFor(() => expect(currentLocation).toBe('/tech'));
    await user.click(within(panel).getByRole('button', { name: '접기' }));
    expect(screen.queryByRole('region', { name: '태그 고르기' })).toBeNull();
    expect(within(bar).getByRole('button', { name: /^태그/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('보안 뉴스 출처도 페이지 안 패널, 칩을 누르면 주소에 반영 (040)', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/security');
    const button = await screen.findByRole('button', { name: /^출처/ });
    await user.click(button);
    const panel = screen.getByRole('region', { name: '출처 고르기' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const chips = await within(panel).findAllByRole('button', { pressed: false });
    await user.click(chips[0]);
    await waitFor(() => expect(currentLocation).toMatch(/^\/security\?sourceIds=\d+$/));
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('019 빠른 선택 소스 기준', () => {
  const s = (id: number, name: string, postCount?: number, recentPostCount?: number) => ({
    id,
    name,
    logoUrl: null,
    type: 'COMPANY' as const,
    postCount,
    recentPostCount,
  });

  it('recentPostCount 내림차순, 동점은 postCount·이름순, 0은 제외', async () => {
    const { pickQuickSources } = await import('@/components/filters/useFilterCatalog');
    const r = pickQuickSources([s(1, '가', 100, 3), s(2, '나', 900, 0), s(3, '다', 50, 3), s(4, '라', 50, 3), s(5, '마', 1, 9)]);
    expect(r.quickBasis).toBe('recent');
    expect(r.quickSources.map((x) => x.id)).toEqual([5, 1, 3, 4]);
  });

  it('recentPostCount가 없으면 postCount 기준, 둘 다 없으면 빠른 선택 없음', async () => {
    const { pickQuickSources } = await import('@/components/filters/useFilterCatalog');
    expect(pickQuickSources([s(1, '가', 3), s(2, '나', 9)]).quickSources.map((x) => x.id)).toEqual([2, 1]);
    expect(pickQuickSources([s(1, '가'), s(2, '나')])).toEqual({ quickSources: [], quickBasis: null });
  });

  it('최대 선택이어도 패널에는 3개까지만, 나머지는 +N개', async () => {
    const tags = [1, 2, 3, 4, 5, 6, 100, 101, 102, 103].join(',');
    renderWithApp(<App />, `/?tagIds=${tags}`);
    const region = await sidebar().findByRole('region', { name: '태그 필터' });
    expect(await within(region).findByRole('button', { name: /^선택한 태그 \d+개 더 보기$/ })).toBeInTheDocument();
  });
});
