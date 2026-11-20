import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { COLOR_SCHEME_KEY, resolveColorScheme } from '@/lib/colorScheme';
import { renderWithApp } from './render';

function mockSystem(dark: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mq = {
    matches: dark,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn),
    removeEventListener: () => undefined,
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mq));
  return {
    change(next: boolean) {
      mq.matches = next;
      listeners.forEach((fn) => fn({ matches: next } as MediaQueryListEvent));
    },
  };
}

afterEach(() => {
  localStorage.removeItem(COLOR_SCHEME_KEY);
  document.documentElement.removeAttribute('data-color-scheme');
  vi.unstubAllGlobals();
});

describe('022 다크/라이트 테마', () => {
  it('처음 접속은 시스템 설정을 따름', () => {
    mockSystem(true);
    expect(resolveColorScheme()).toBe('dark');
    mockSystem(false);
    expect(resolveColorScheme()).toBe('light');
  });

  it('버튼으로 전환하면 즉시 바뀌고 저장되며, 저장값이 시스템 설정보다 우선함', async () => {
    mockSystem(false);
    const user = userEvent.setup();
    const { unmount } = renderWithApp(<App />, '/');
    await user.click(await screen.findByRole('button', { name: '다크 테마로 전환' }));
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(localStorage.getItem(COLOR_SCHEME_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: '라이트 테마로 전환' })).toBeInTheDocument();
    unmount();
    expect(resolveColorScheme()).toBe('dark');
  });

  it('직접 고른 적이 없을 때만 시스템 변경을 따라감', async () => {
    const sys = mockSystem(false);
    document.documentElement.setAttribute('data-color-scheme', 'light');
    renderWithApp(<App />, '/');
    await screen.findByRole('button', { name: '다크 테마로 전환' });
    sys.change(true);
    expect(await screen.findByRole('button', { name: '라이트 테마로 전환' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');

    localStorage.setItem(COLOR_SCHEME_KEY, 'dark');
    sys.change(false);
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
  });
});
