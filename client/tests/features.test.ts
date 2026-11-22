import { afterEach, describe, expect, it, vi } from 'vitest';

describe('VITE_HIDE_M7 공개 빌드 스위치', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('켜면 보안 뉴스 탭·분야를 숨기고 field를 요청에 넣지 않음', async () => {
    vi.stubEnv('VITE_HIDE_M7', 'true');
    vi.resetModules();
    const { SECTIONS, isFieldTab } = await import('@/components/layout/FeedTabs');
    const { parseFeedFilters } = await import('@/hooks/useFeedFilters');
    expect(SECTIONS.map((t) => t.label)).toEqual(['자유 게시판', '기술 뉴스']);
    expect(isFieldTab('/tech')).toBe(false);
    expect(parseFeedFilters(new URLSearchParams('field=ai')).field).toBeNull();
  });

  it('기본값은 모두 노출', async () => {
    const { SECTIONS, isFieldTab } = await import('@/components/layout/FeedTabs');
    expect(SECTIONS.map((t) => t.label)).toEqual(['자유 게시판', '기술 뉴스', '보안 뉴스']);
    expect(isFieldTab('/tech/popular')).toBe(true);
    expect(isFieldTab('/security/popular')).toBe(false);
  });
});
