import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { App } from '@/App';
import { parsePeriod } from '@/features/popular/PopularPage';
import { currentLocation, renderWithApp, seedLogin } from './render';

const ranking = () => within(screen.getByRole('list', { name: '인기 글 순위' }));

describe('S-03 인기 글', () => {
  it('잘못된 기간 값은 기본값(7일)으로 해석함', () => {
    expect(parsePeriod('YEAR')).toBe('WEEK');
    expect(parsePeriod(null)).toBe('WEEK');
    expect(parsePeriod('DAY')).toBe('DAY');
  });

  it('조회수 내림차순으로 순위와 조회수를 보여줌', async () => {
    renderWithApp(<App />, '/tech/popular');
    await screen.findByRole('list', { name: '인기 글 순위' });
    const counts = ranking()
      .getAllByText(/^조회 /)
      .map((el) => Number(el.textContent!.replace(/[^0-9]/g, '')));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.length).toBeLessThanOrEqual(20);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it('기간 탭을 바꾸면 URL에 반영하고 결과가 바뀜', async () => {
    const user = userEvent.setup();
    renderWithApp(<App />, '/tech/popular');
    await screen.findByRole('list', { name: '인기 글 순위' });
    const weekCount = ranking().getAllByRole('article').length;
    await user.click(screen.getByRole('radio', { name: '24시간' }));
    await waitFor(() => expect(currentLocation).toBe('/tech/popular?period=DAY'));
    await waitFor(() => expect(ranking().getAllByRole('article').length).toBeLessThan(weekCount));
    await user.click(screen.getByRole('radio', { name: '7일' }));
    await waitFor(() => expect(currentLocation).toBe('/tech/popular'));
  });

  it('결과가 없으면 최신 피드 링크가 있는 빈 화면을 보여줌', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/posts/popular', () => HttpResponse.json({ items: [] })));
    renderWithApp(<App />, '/tech/popular?period=DAY');
    expect(await screen.findByText('이 기간에 읽힌 글이 아직 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '최신 피드 보기' }));
    await waitFor(() => expect(currentLocation).toBe('/tech'));
  });

  it('조회수 0인 글은 순위에 없음', async () => {
    renderWithApp(<App />, '/popular?period=MONTH');
    await screen.findByRole('list', { name: '인기 글 순위' });
    expect(ranking().queryByText('조회 0')).not.toBeInTheDocument();
  });

  it('회원이 북마크하면 인기 글 목록에 즉시 반영함', async () => {
    const user = userEvent.setup();
    await seedLogin('admin@devfeed.dev');
    renderWithApp(<App />, '/tech/popular');
    await screen.findByRole('list', { name: '인기 글 순위' });
    const first = ranking().getAllByRole('article')[0];
    await user.click(within(first).getByRole('button', { name: '북마크' }));
    expect(await within(ranking().getAllByRole('article')[0]).findByRole('button', { name: '북마크 해제' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
