import { useCallback, useEffect, useState } from 'react';

export type ColorScheme = 'light' | 'dark';

export const COLOR_SCHEME_KEY = 'devfeed-color-scheme';
const THEME_COLOR: Record<ColorScheme, string> = { light: '#fbfbfc', dark: '#0b0b0d' };
const QUERY = '(prefers-color-scheme: dark)';

function readStored(): ColorScheme | null {
  try {
    const v = localStorage.getItem(COLOR_SCHEME_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

function systemScheme(): ColorScheme {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

function store(scheme: ColorScheme) {
  try {
    localStorage.setItem(COLOR_SCHEME_KEY, scheme);
  } catch {
    return;
  }
}

export function resolveColorScheme(): ColorScheme {
  return readStored() ?? systemScheme();
}

export function applyColorScheme(scheme: ColorScheme) {
  document.documentElement.setAttribute('data-color-scheme', scheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[scheme]);
}

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme>(() => {
    const attr = document.documentElement.getAttribute('data-color-scheme');
    return attr === 'dark' || attr === 'light' ? attr : resolveColorScheme();
  });

  useEffect(() => {
    applyColorScheme(scheme);
  }, [scheme]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => {
      if (!readStored()) setScheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setScheme((prev) => {
      const next: ColorScheme = prev === 'dark' ? 'light' : 'dark';
      store(next);
      return next;
    });
  }, []);

  return { scheme, toggle };
}
