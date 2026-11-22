import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { AD_MEDIA, AD_SCRIPT_SRC, AD_SLOTS } from '@/lib/ads';
import { currentLocation, renderWithApp, seedLogin } from './render';

function mockWidth(wide: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === AD_MEDIA ? wide : false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

const ads = () => screen.queryAllByRole('complementary', { name: '광고' });
const scripts = () => document.querySelectorAll(`script[src="${AD_SCRIPT_SRC}"]`);

let push: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.querySelectorAll(`script[src="${AD_SCRIPT_SRC}"]`).forEach((s) => s.remove());
  push = vi.fn();
  window.adsbygoogle = { push } as unknown as unknown[];
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.adsbygoogle;
});

describe('F-060 좌우 광고 (025)', () => {
  it('1440px 이상 공개 콘텐츠 화면에 좌우 광고 단위가 하나씩 보임', async () => {
    mockWidth(true);
    renderWithApp(<App />, '/');
    await waitFor(() => expect(ads()).toHaveLength(2));
    const slots = ads().map((a) => a.querySelector('ins')?.getAttribute('data-ad-slot'));
    expect(slots).toEqual([AD_SLOTS.left, AD_SLOTS.right]);
    expect(ads()[0].querySelector('ins')).toHaveAttribute('data-ad-client', 'ca-pub-1750461537555326');
  });

  it.each(['/popular', '/security', '/search?q=kafka'])('%s 에도 광고가 보임', async (path) => {
    mockWidth(true);
    renderWithApp(<App />, path);
    await waitFor(() => expect(ads()).toHaveLength(2));
  });

  it('회원 추천 화면에도 광고가 보임', async () => {
    mockWidth(true);
    await seedLogin('user@devfeed.dev');
    renderWithApp(<App />, '/for-you');
    await screen.findByRole('region', { name: '추천 피드' });
    expect(ads()).toHaveLength(2);
  });

  it('1440px 미만에서는 광고 영역과 스크립트 요청이 없음', async () => {
    mockWidth(false);
    renderWithApp(<App />, '/');
    await screen.findByRole('navigation', { name: '피드' });
    expect(ads()).toHaveLength(0);
    expect(scripts()).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it.each(['/login', '/signup', '/privacy', '/me/bookmarks', '/admin', '/no-such-page'])('%s 에는 광고가 없음', async (path) => {
    mockWidth(true);
    renderWithApp(<App />, path);
    await new Promise((r) => setTimeout(r, 50));
    expect(ads()).toHaveLength(0);
  });

  it('탭을 오가도 스크립트는 1번, 광고 요청은 단위당 1번', async () => {
    mockWidth(true);
    const user = userEvent.setup();
    renderWithApp(<App />, '/');
    await waitFor(() => expect(ads()).toHaveLength(2));
    const nav = within(screen.getByRole('navigation', { name: '피드' }));
    for (const name of ['보안 뉴스', '기술 뉴스']) {
      await user.click(nav.getByRole('link', { name }));
      expect(ads()).toHaveLength(2);
    }
    await user.type(screen.getByRole('searchbox', { name: '검색어' }), 'kafka{Enter}');
    await waitFor(() => expect(currentLocation).toMatch(/^\/search/));
    expect(ads()).toHaveLength(2);
    expect(scripts()).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(2);
  });
});
