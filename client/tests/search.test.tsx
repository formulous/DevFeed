import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { mockPosts } from '@/mocks/fixtures';
import { server } from '@/mocks/node';
import { App } from '@/App';
import { pageWindow } from '@/components/common/Pagination';
import { parseSearch, toSearchParams } from '@/hooks/useSearchState';
import { currentLocation, renderWithApp } from './render';

const results = () => within(screen.getByRole('region', { name: '검색 결과' }));

describe('search URL state', () => {
  it('잘못된 값은 기본값으로, 페이지는 1~50으로 제한함', () => {
    const s = parseSearch(new URLSearchParams('q=%20kafka%20&period=2W&sort=X&page=99&tagIds=1,a,1'));
    expect(s).toEqual({ q: 'kafka', scope: 'tech', tagIds: [1], sourceIds: [], region: null, category: null, period: 'ALL', sort: 'RELEVANCE', page: 50 });
  });

  it('기본값은 URL에서 뺌', () => {
    const p = toSearchParams({ q: 'redis', scope: 'tech', tagIds: [], sourceIds: [2], region: null, category: null, period: 'ALL', sort: 'LATEST', page: 1 });
    expect(p.toString()).toBe('q=redis&sourceIds=2&sort=LATEST');
  });

  it('페이지 번호 창은 범위 안에서 현재 페이지를 가운데 둠', () => {
    expect(pageWindow(1, 3, 5)).toEqual([1, 2, 3]);
    expect(pageWindow(10, 50, 5)).toEqual([8, 9, 10, 11, 12]);
    expect(pageWindow(50, 50, 5)).toEqual([46, 47, 48, 49, 50]);
  });
});

describe('S-04 검색 결과', () => {
  it('헤더에서 검색하면 결과 건수와 하이라이트를 보여줌', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    const box = screen.getByRole('searchbox', { name: '검색어' });
    await user.type(box, '리밸런싱{Enter}');
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EB%A6%AC%EB%B0%B8%EB%9F%B0%EC%8B%B1'));
    expect(await screen.findByText(/건$/)).toBeInTheDocument();
    const marks = results().getAllByText('리밸런싱', { selector: 'mark' });
    expect(marks.length).toBeGreaterThan(0);
  });

  it('검색어 1자는 헤더에서 막고, URL로 들어와도 요청하지 않음', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=a');
    expect(await screen.findByText('검색어는 2자 이상 입력해 주세요')).toBeInTheDocument();
    const box = screen.getByRole('searchbox', { name: '검색어' });
    expect(box).toHaveValue('a');
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
    await user.type(box, 'b');
    expect(screen.getByRole('button', { name: '검색' })).toBeEnabled();
  });

  it('정렬·필터를 바꾸면 URL에 반영하고 페이지를 1로 되돌림', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=%EC%A0%95%EB%A6%AC&page=2');
    await screen.findByRole('navigation', { name: '페이지' });
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    await user.click(within(screen.getByRole('group', { name: '정렬' })).getByRole('button', { name: '최신순' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EC%A0%95%EB%A6%AC&sort=LATEST'));
    await user.click(screen.getByRole('radio', { name: '1주' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EC%A0%95%EB%A6%AC&period=1W&sort=LATEST'));
  });

  it('페이지 이동 시 URL에 page를 남김', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=%EC%A0%95%EB%A6%AC');
    await user.click(await screen.findByRole('button', { name: '다음 페이지' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EC%A0%95%EB%A6%AC&page=2'));
    expect(await screen.findByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
  });

  it('totalCapped면 1,000건 이상으로 표시하고 마지막 페이지에서 상한 안내', async () => {
    const items = mockPosts.slice(0, 20);
    server.use(
      http.get('*/api/search', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        return HttpResponse.json({ items, total: 1000, totalCapped: true, page, size: 20 });
      }),
    );
    renderWithApp(<App />, '/search?q=%EA%B0%9C%EB%B0%9C&page=50');
    expect(await screen.findByText('1,000건 이상')).toBeInTheDocument();
    expect(screen.getByText(/상위 1,000건까지만 볼 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50' })).toHaveAttribute('aria-current', 'page');
  });

  it('totalCapped가 없으면 정확한 건수로 표시함', async () => {
    server.use(
      http.get('*/api/search', () => HttpResponse.json({ items: mockPosts.slice(0, 3), total: 3, page: 1, size: 20 })),
    );
    renderWithApp(<App />, '/search?q=%EA%B0%9C%EB%B0%9C');
    expect(await screen.findByText('3건')).toBeInTheDocument();
  });

  it('결과가 없으면 안내와 인기 태그를, 필터가 있으면 초기화 버튼도 보여줌', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=zzzz&period=1W');
    expect(await screen.findByText('기술 뉴스에서 찾지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '인기 태그' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '필터 초기화' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=zzzz'));
    expect(await screen.findByText('철자를 확인하거나 다른 키워드로 검색해 보세요')).toBeInTheDocument();
  });
});
