import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { server } from '@/mocks/node';
import { renderWithApp } from './render';

const top = () => screen.findByRole('region', { name: '이번 주 인기' });

function captureTop() {
  const seen: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.url.includes('sort=REACTIONS')) seen.push(request.url);
  });
  return seen;
}

const score = (text: string) => {
  const like = Number(/좋아요 (\d+)/.exec(text)?.[1] ?? 0);
  const comment = Number(/댓글 (\d+)/.exec(text)?.[1] ?? 0);
  return like + comment;
};

describe('이번 주 인기 TOP 3 (042)', () => {
  it('기술 뉴스 최신순: 3건 이하, 좋아요+댓글 순서, 분야 반영, 더 보기는 댓글순', async () => {
    const seen = captureTop();
    renderWithApp(<App />, '/tech?field=backend');
    const region = await top();
    const items = await within(region).findAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    const scores = items.map((li) => score([...li.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' ')));
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(scores.every((s) => s >= 1)).toBe(true);
    expect(within(items[0]).getByLabelText('1위')).toHaveClass('text-brand');
    expect(within(items[0]).getByRole('link')).toHaveAttribute('target', '_blank');
    expect(within(region).getByRole('link', { name: '더 보기 ›' })).toHaveAttribute('href', '/tech/comments?field=backend');
    expect(seen.some((u) => u.includes('/api/posts/popular') && u.includes('period=WEEK') && u.includes('size=3') && u.includes('field=BACKEND'))).toBe(true);
  });

  it('자유 게시판은 상세로, 더 보기는 좋아요순', async () => {
    renderWithApp(<App />, '/community');
    const region = await top();
    const first = (await within(region).findAllByRole('link')).find((a) => a.getAttribute('href')?.startsWith('/community/posts/'));
    expect(first).toBeDefined();
    expect(within(region).getByRole('link', { name: '더 보기 ›' })).toHaveAttribute('href', '/community/likes');
  });

  it('0건이거나 실패하면 영역을 숨기고 목록은 그대로', async () => {
    server.use(http.get('*/api/security-news/popular', () => HttpResponse.json({ items: [] })));
    const first = renderWithApp(<App />, '/security');
    await screen.findAllByRole('article');
    expect(screen.queryByTestId('weekly-top')).toBeNull();
    first.unmount();

    server.use(http.get('*/api/posts/popular', () => HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 })));
    renderWithApp(<App />, '/tech');
    await screen.findAllByRole('article');
    await waitFor(() => expect(screen.queryByTestId('weekly-top')).toBeNull());
  });

  it('인기·댓글순 화면에는 넣지 않음', async () => {
    renderWithApp(<App />, '/tech/comments');
    await screen.findAllByRole('article');
    expect(screen.queryByTestId('weekly-top')).toBeNull();
  });
});
