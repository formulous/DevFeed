import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
