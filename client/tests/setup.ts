import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { setAccessToken } from '@/api/http';
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  observers.clear();
  server.resetHandlers();
  resetMockState();
  setAccessToken(null);
});
afterAll(() => server.close());
