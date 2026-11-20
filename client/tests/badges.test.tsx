import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PostSummary } from '@/api/types';
import { App } from '@/App';
import { PostCard } from '@/components/post/PostCard';
import { isNewPost } from '@/lib/time';
import { mockPosts } from '@/mocks/fixtures';
import { renderWithApp } from './render';

const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const post = (over: Partial<PostSummary>): PostSummary => ({ ...mockPosts[0], publishedAt: hoursAgo(48), ...over });
const card = (p: PostSummary, badges?: 'all' | 'new' | 'none') =>
  render(<PostCard post={p} badges={badges} onOpen={() => {}} onToggleBookmark={() => {}} />);

describe('F-014 글 카드 배지', () => {
  afterEach(() => vi.useRealTimers());

  it('24시간 이내 발행 글만 NEW', () => {
    expect(isNewPost(hoursAgo(23.9), NOW)).toBe(true);
    expect(isNewPost(hoursAgo(25), NOW)).toBe(false);
    expect(isNewPost(hoursAgo(-1), NOW)).toBe(false);
  });

  it('NEW·인기 둘 다 해당하면 NEW, 인기 순으로 표시함', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    card(post({ publishedAt: hoursAgo(2), isPopular: true }));
    const badges = within(screen.getByTestId('post-badges'));
    expect(badges.getAllByText(/^(NEW|인기)$/).map((el) => el.textContent)).toEqual(['NEW', '인기']);
  });

  it('isPopular가 없거나 false면 인기 배지를 생략하고 정상 렌더링함', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const { unmount } = card(post({ isPopular: undefined }));
    expect(screen.queryByTestId('post-badges')).toBeNull();
    expect(screen.getByRole('article')).toBeInTheDocument();
    unmount();
    card(post({ isPopular: false }));
    expect(screen.queryByText('인기')).toBeNull();
  });

  it('인기 화면 모드는 NEW만, 기록 화면 모드는 배지 없음', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const p = post({ publishedAt: hoursAgo(1), isPopular: true });
    const { unmount } = card(p, 'new');
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.queryByText('인기')).toBeNull();
    unmount();
    card(p, 'none');
    expect(screen.queryByTestId('post-badges')).toBeNull();
  });

  it('mock 피드에서 7일 인기 상위 글에 인기 배지가 붙고 S-03에는 붙지 않음', async () => {
    const { unmount } = renderWithApp(<App />, '/');
    await screen.findAllByRole('article');
    const popularBadges = await screen.findAllByText('인기', { selector: 'span' });
    expect(popularBadges.length).toBeGreaterThan(0);
    expect(popularBadges.length).toBeLessThanOrEqual(20);
    unmount();
    renderWithApp(<App />, '/popular');
    const ranking = await screen.findByRole('list', { name: '인기 글 순위' });
    expect(within(ranking).queryAllByText('인기', { selector: 'span' })).toHaveLength(0);
  });
});
