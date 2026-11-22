import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { App } from '@/App';
import { parseSecurityNews } from '@/features/security/useSecurityNewsState';
import { dayLabel } from '@/lib/time';
import { mockNewsPosts, mockNewsSources } from '@/mocks/fixtures';
import { currentLocation, renderWithApp } from './render';

const feed = () => screen.findByRole('region', { name: '보안 뉴스' });
const domestic = mockNewsSources.filter((s) => s.region === 'DOMESTIC').map((s) => s.name);

describe('S-14 보안 뉴스', () => {
  it('날짜 구분선과 최신 보안 뉴스를 보여주고 썸네일·인기 배지는 없음', async () => {
    renderWithApp(<App />, '/security');
    const region = await feed();
    expect(await within(region).findByText(mockNewsPosts[0].title)).toBeInTheDocument();
    expect(within(region).getAllByRole('article')).toHaveLength(20);
    expect(within(region).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(1);
    expect(region.querySelectorAll('article img')).toHaveLength(0);
    expect(within(region).queryByText('인기', { selector: 'span' })).toBeNull();
  });

  it('지역 세그먼트와 출처 칩을 URL에 반영하고 결과를 거름', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/security');
    const region = await feed();
    await within(region).findByText(mockNewsPosts[0].title);
    await user.click(screen.getByRole('radio', { name: '국내' }));
    await waitFor(() => expect(currentLocation).toBe('/security?region=domestic'));
    await waitFor(() => {
      const articles = within(region).getAllByRole('article');
      expect(articles.every((a) => domestic.some((n) => a.textContent?.includes(n)))).toBe(true);
    });
    const sidebar = screen.getByRole('complementary', { name: '출처 필터' });
    await user.click(within(sidebar).getByRole('button', { name: 'KISA 보호나라' }));
    await waitFor(() => expect(currentLocation).toBe('/security?region=domestic&sourceIds=201'));
    await waitFor(() => {
      const articles = within(region).getAllByRole('article');
      expect(articles.every((a) => a.textContent?.includes('KISA 보호나라'))).toBe(true);
    });
    await user.click(screen.getByRole('radio', { name: '해외' }));
    expect(await screen.findByText('조건에 맞는 보안 뉴스가 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '필터 초기화' }));
    await waitFor(() => expect(currentLocation).toBe('/security'));
  });

  it('URL 파싱: 잘못된 지역은 전체, 출처 ID는 정수만', () => {
    expect(parseSecurityNews(new URLSearchParams('region=moon&sourceIds=200,x,200,203'))).toEqual({
      region: null,
      sourceIds: [200, 203],
    });
    expect(parseSecurityNews(new URLSearchParams('region=overseas')).region).toBe('OVERSEAS');
  });

  it('날짜 라벨: 오늘·어제·M월 D일, 다른 해는 연도 포함', () => {
    const now = new Date(2026, 10, 20, 15).getTime();
    expect(dayLabel(new Date(2026, 10, 20, 1).toISOString(), now)).toBe('오늘');
    expect(dayLabel(new Date(2026, 10, 19, 23).toISOString(), now)).toBe('어제');
    expect(dayLabel(new Date(2026, 10, 3, 9).toISOString(), now)).toBe('11월 3일');
    expect(dayLabel(new Date(2025, 11, 31, 9).toISOString(), now)).toBe('2025년 12월 31일');
  });
});

describe('F-072 보안 뉴스 인기 (031)', () => {
  const ranking = () => within(screen.getByRole('list', { name: '인기 보안 뉴스 순위' }));
  const newsTitles = new Set(mockNewsPosts.map((p) => p.title));
  const titlesShown = () => ranking().getAllByRole('article').map((a) => within(a).getAllByRole('link')[0].textContent ?? '');

  it('보안 뉴스만 조회수 순으로, 순위 번호·조회수와 함께 보여 주고 인기 배지는 없음', async () => {
    const requests: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/security-news/popular')) requests.push(request.url);
    });
    renderWithApp(<App />, '/security/popular');
    await screen.findByRole('list', { name: '인기 보안 뉴스 순위' });
    const titles = titlesShown();
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((t) => newsTitles.has(t))).toBe(true);
    const counts = ranking().getAllByText(/^조회 [\d,]+$/).map((el) => Number(el.textContent!.replace(/\D/g, '')));
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(ranking().queryByText('인기')).toBeNull();
    expect(new URL(requests[0]).search).toBe('?period=WEEK');
    server.events.removeAllListeners();
  });

  it('지역·기간을 바꾸면 URL과 요청에 반영하고 출처 선택은 보내지 않음', async () => {
    const requests: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/security-news/popular')) requests.push(new URL(request.url).search);
    });
    const user = userEvent.setup();
    renderWithApp(<App />, '/security/popular?sourceIds=901');
    await screen.findByRole('list', { name: '인기 보안 뉴스 순위' });
    await user.click(screen.getByRole('radio', { name: '국내' }));
    await waitFor(() => expect(currentLocation).toBe('/security/popular?sourceIds=901&region=domestic'));
    await user.click(screen.getByRole('radio', { name: '30일' }));
    await waitFor(() => expect(currentLocation).toBe('/security/popular?sourceIds=901&region=domestic&period=MONTH'));
    await waitFor(() => expect(requests.at(-1)).toBe('?period=MONTH&region=DOMESTIC'));
    expect(requests.every((q) => !q.includes('sourceIds'))).toBe(true);
    const domesticNames = new Set(mockNewsSources.filter((s) => s.region === 'DOMESTIC').map((s) => s.name));
    await waitFor(() =>
      expect(ranking().getAllByRole('article').every((a) => [...domesticNames].some((n) => a.textContent?.includes(n)))).toBe(true),
    );
    server.events.removeAllListeners();
  });

  it('결과가 없으면 안내와 함께 최신 보안 뉴스로 가는 링크를 보여 줌 (지역·출처 유지)', async () => {
    server.use(http.get('*/api/security-news/popular', () => HttpResponse.json({ items: [] })));
    const user = userEvent.setup();
    renderWithApp(<App />, '/security/popular?region=overseas&sourceIds=901&period=DAY');
    expect(await screen.findByText('이 기간에 읽힌 보안 뉴스가 아직 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '최신 보안 뉴스 보기' }));
    await waitFor(() => expect(currentLocation).toBe('/security?region=overseas&sourceIds=901'));
  });

  it('보안 인기 화면에도 프로필 카드가 좌측 맨 위에 있음', async () => {
    renderWithApp(<App />, '/security/popular');
    const guest = await screen.findByTestId('guest-card');
    expect(guest.closest('aside')!.firstElementChild).toBe(guest);
  });
});
