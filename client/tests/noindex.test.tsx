import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { isNoindex } from '@/components/layout/RouteTitle';
import { renderWithApp } from './render';

describe('비공개 화면 noindex', () => {
  it('경로별로 판단함', () => {
    for (const p of ['/login', '/signup', '/onboarding/tags', '/me/bookmarks', '/admin', '/admin/sources/3/edit']) {
      expect(isNoindex(p)).toBe(true);
    }
    for (const p of ['/', '/for-you', '/popular', '/search', '/privacy']) expect(isNoindex(p)).toBe(false);
  });

  it('화면 이동에 따라 meta robots를 붙이고 뗌', async () => {
    renderWithApp(<App />, '/login');
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex'));
  });

  it('공개 화면에는 meta robots가 없음', async () => {
    document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
    renderWithApp(<App />, '/popular');
    await screen.findByRole('heading', { name: '인기 글' });
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
