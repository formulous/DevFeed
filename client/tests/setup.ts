import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { setAccessToken } from '@/api/http';
import { SORT_TABS_MEDIA } from '@/lib/ads';
import { resetMockState } from '@/mocks/handlers';
import { server } from '@/mocks/node';

export const observers = new Set<IntersectionObserverStub>();

class IntersectionObserverStub {
  constructor(public callback: IntersectionObserverCallback) {}
  observe = vi.fn(() => observers.add(this));
  unobserve = vi.fn();
  disconnect = vi.fn(() => observers.delete(this));
  takeRecords = vi.fn(() => []);
}

export function triggerIntersect() {
  for (const o of [...observers]) {
    o.callback([{ isIntersecting: true } as IntersectionObserverEntry], o as unknown as IntersectionObserver);
  }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

const realMatchMedia = window.matchMedia.bind(window);
const flags = globalThis as { __sortTabs?: boolean };
window.matchMedia = ((query: string) =>
  query === SORT_TABS_MEDIA
    ? ({ matches: !!flags.__sortTabs, media: query, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as MediaQueryList)
    : realMatchMedia(query)) as typeof window.matchMedia;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  observers.clear();
  server.resetHandlers();
  resetMockState();
  setAccessToken(null);
  flags.__sortTabs = false;
});
afterAll(() => server.close());
