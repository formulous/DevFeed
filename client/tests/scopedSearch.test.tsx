import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/App';
import { server } from '@/mocks/node';
import { HIDDEN_REPORT_POST_ID } from '@/mocks/community';
import { currentLocation, renderWithApp } from './render';

const results = () => within(screen.getByRole('region', { name: '검색 결과' }));
const scopeTabs = () => within(screen.getByRole('navigation', { name: '검색 범위' }));
const feedNav = () => within(screen.getByRole('navigation', { name: '피드' }));

beforeEach(() => {
  sessionStorage.clear();
});

describe('038 페이지별 검색', () => {
  it('검색창 안내 문구가 페이지에 맞고, 자유 게시판에서 검색하면 그 범위 결과로 감', async () => {
    const user = userEvent.setup();
    const first = renderWithApp(<App />, '/security');
    expect(await screen.findByPlaceholderText('보안 뉴스 검색…')).toBeInTheDocument();
    first.unmount();

    renderWithApp(<App />, '/community');
    const box = await screen.findByPlaceholderText('자유 게시판 검색…');
    await user.type(box, '모노레포{Enter}');
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EB%AA%A8%EB%85%B8%EB%A0%88%ED%8F%AC&scope=community'));
    const link = await results().findByRole('link', { name: '모노레포 vs 멀티레포, 팀 규모별 경험 나눠요' });
    expect(link.getAttribute('href')).toMatch(/^\/community\/posts\/\d+$/);
    expect(scopeTabs().getByRole('link', { name: '자유 게시판' })).toHaveAttribute('aria-current', 'page');
    expect(feedNav().getByRole('link', { name: '자유 게시판' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByPlaceholderText('자유 게시판 검색…')).toHaveValue('모노레포');
    expect(screen.getByRole('radiogroup', { name: '말머리' })).toBeInTheDocument();
    expect(screen.queryByTestId('filter-sidebar')).toBeNull();
  });

  it('범위 탭은 1단 탭과 같은 순서이고 정렬은 글자 탭임', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=kafka');
    await screen.findByRole('navigation', { name: '검색 범위' });
    expect(scopeTabs().getAllByRole('link').map((a) => a.textContent)).toEqual(['자유 게시판', '기술 뉴스', '보안 뉴스']);
    expect(screen.queryByRole('combobox', { name: '정렬' })).toBeNull();
    const sort = screen.getByRole('group', { name: '정렬' });
    expect(within(sort).getByRole('button', { name: '관련도순' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(sort).getByRole('button', { name: '최신순' }));
    expect(currentLocation).toBe('/search?q=kafka&sort=LATEST');
    expect(within(sort).getByRole('button', { name: '최신순' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('범위 탭을 바꾸면 검색어·정렬·기간은 유지하고 범위 필터·페이지는 초기화함', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/search?q=kafka&tagIds=1&sort=LATEST&period=1Y&page=2');
    await screen.findByRole('navigation', { name: '검색 범위' });
    await user.click(scopeTabs().getByRole('link', { name: '보안 뉴스' }));
    expect(currentLocation).toBe('/search?q=kafka&scope=security&period=1Y&sort=LATEST');
    expect(screen.getByRole('radiogroup', { name: '지역' })).toBeInTheDocument();
    await user.click(scopeTabs().getByRole('link', { name: '기술 뉴스' }));
    expect(currentLocation).toBe('/search?q=kafka&period=1Y&sort=LATEST');
  });

  it('보안 뉴스는 한글 부분 일치·지역 필터, 기술 뉴스 결과에는 다른 범위 글이 없음', async () => {
    const user = userEvent.setup();
    const first = renderWithApp(<App />, '/search?q=%EC%B7%A8%EC%95%BD&scope=security');
    const cards = await results().findAllByRole('article');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.textContent!.includes('취약'))).toBe(true);
    await user.click(screen.getByRole('radio', { name: '해외' }));
    await waitFor(() => expect(currentLocation).toBe('/search?q=%EC%B7%A8%EC%95%BD&scope=security&region=OVERSEAS'));
    first.unmount();

    renderWithApp(<App />, '/search?q=kafka');
    await results().findAllByRole('article');
    expect(results().queryByRole('link', { name: 'Kafka 컨슈머 랙이 계속 쌓여요' })).toBeNull();
  });

  it('자유 게시판 검색은 숨긴 글을 빼고, 주소에 섞인 다른 범위 필터는 API에 보내지 않음', async () => {
    const seen: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/api/search')) seen.push(request.url);
    });
    renderWithApp(<App />, '/search?q=XSS&scope=community&tagIds=1&region=OVERSEAS');
    const links = await results().findAllByRole('link', { name: /XSS 문자열이 든 글/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => !l.getAttribute('href')!.endsWith(`/${HIDDEN_REPORT_POST_ID}`))).toBe(true);
    const url = new URL(seen.at(-1)!);
    expect(url.searchParams.get('scope')).toBe('COMMUNITY');
    expect(url.searchParams.has('tagIds') || url.searchParams.has('region')).toBe(false);
    server.events.removeAllListeners();
  });

  it('결과가 없으면 범위 이름을 넣어 안내하고 다른 범위 검색 링크를 줌', async () => {
    server.use(http.get('*/api/search', () => HttpResponse.json({ items: [], total: 0, totalCapped: false, page: 1, size: 20 })));
    renderWithApp(<App />, '/search?q=%EC%97%86%EB%8A%94%EB%A7%90&scope=community');
    expect(await screen.findByText('자유 게시판에서 찾지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '기술 뉴스에서 검색' })).toHaveAttribute('href', '/search?q=%EC%97%86%EB%8A%94%EB%A7%90');
    expect(screen.getByRole('link', { name: '보안 뉴스에서 검색' })).toHaveAttribute(
      'href',
      '/search?q=%EC%97%86%EB%8A%94%EB%A7%90&scope=security',
    );
  });

  it('범위가 정해지지 않는 화면은 마지막 범위를 씀', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/community');
    await screen.findByPlaceholderText('자유 게시판 검색…');
    await user.click(screen.getByRole('link', { name: '개인정보 안내' }));
    expect(await screen.findByRole('link', { name: '자유 게시판 검색으로 이동' })).toHaveAttribute('href', '/search?scope=community');
  });
});
