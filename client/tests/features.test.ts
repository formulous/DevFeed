import { afterEach, describe, expect, it, vi } from 'vitest';

describe('VITE_HIDE_M7 공개 빌드 스위치', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('켜면 보안 뉴스 탭·분야를 숨기고 field를 요청에 넣지 않음', async () => {
    vi.stubEnv('VITE_HIDE_M7', 'true');
    vi.resetModules();
    const { FEED_TABS, isFieldTab } = await import('@/components/layout/FeedTabs');
    const { parseFeedFilters } = await import('@/hooks/useFeedFilters');
    expect(FEED_TABS.map((t) => t.label)).toEqual(['최신', '추천', '인기']);
    expect(isFieldTab('/')).toBe(false);
    expect(parseFeedFilters(new URLSearchParams('field=ai')).field).toBeNull();
  });

  it('기본값은 모두 노출', async () => {
    const { FEED_TABS, isFieldTab } = await import('@/components/layout/FeedTabs');
    expect(FEED_TABS).toHaveLength(4);
    expect(isFieldTab('/popular')).toBe(true);
  });
});
