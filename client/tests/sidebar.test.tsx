import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { orderSelectedFirst } from '@/components/filters/CheckList';
import { currentLocation, renderWithApp } from './render';

const sidebar = () => within(screen.getByTestId('filter-sidebar'));

describe('016 필터 사이드바', () => {
  it('선택한 항목을 앞으로 올림', () => {
    const items = [1, 2, 3, 4].map((id) => ({ id }));
    expect(orderSelectedFirst(items, [3, 4]).map((i) => i.id)).toEqual([3, 4, 1, 2]);
  });

  it('데스크톱 사이드바는 고정·독립 스크롤', async () => {
    renderWithApp(<App />, '/');
    const aside = await screen.findByTestId('filter-sidebar');
    expect(aside.className).toMatch(/lg:sticky/);
    expect(aside.className).toMatch(/lg:max-h-\[calc\(100dvh-8\.5rem\)\]/);
    expect(aside.className).toMatch(/lg:overflow-y-auto/);
    expect(aside.className).toMatch(/lg:overscroll-contain/);
  });

  it('더보기로 펼치면 목록이 섹션 안에서 스크롤됨', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const tagList = await sidebar().findByRole('list', { name: '태그 목록' });
    expect(tagList.className).not.toMatch(/overflow-y-auto/);
    await user.click(sidebar().getAllByRole('button', { name: /^더보기/ })[0]);
    expect(tagList.className).toMatch(/max-h-72 overflow-y-auto overscroll-contain/);
    expect(within(tagList).getAllByRole('checkbox').length).toBeGreaterThan(40);
  });

  it('접힌 상태에서도 선택한 항목은 맨 위에 보임', async () => {
    renderWithApp(<App />, '/?tagIds=129');
    const tagList = await sidebar().findByRole('list', { name: '태그 목록' });
    await waitFor(() => expect(within(tagList).getAllByRole('checkbox')[0]).toBeChecked());
    expect(within(tagList).getAllByRole('listitem')[0]).toHaveTextContent('Testing');
  });

  it('모바일 드로어: 고르면 바로 적용, 초기화, 결과 보기로 닫음', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=%EC%A0%95%EB%A6%AC');
    await user.click(await screen.findByRole('button', { name: '필터' }));
    const drawer = screen.getByRole('dialog', { name: '필터' });
    expect(within(drawer).getByTestId('filter-drawer-body').className).toMatch(/overflow-y-auto overscroll-contain/);
    await user.click(within(drawer).getByRole('radio', { name: '1주' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EC%A0%95%EB%A6%AC&period=1W'));
    expect(screen.getByRole('button', { name: '필터 1' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: '초기화' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EC%A0%95%EB%A6%AC'));
    await user.click(within(drawer).getByRole('button', { name: '결과 보기' }));
    expect(screen.queryByRole('dialog', { name: '필터' })).not.toBeInTheDocument();
  });
});
