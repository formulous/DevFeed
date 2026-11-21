import { useEffect, useState } from 'react';

export const AD_CLIENT = 'ca-pub-1750461537555326';
export const AD_SLOTS = { left: '3021654585', right: '2195210969' } as const;
export const AD_MEDIA = '(min-width: 1440px)';
export const AD_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function loadAdScript() {
  if (document.querySelector(`script[src="${AD_SCRIPT_SRC}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = AD_SCRIPT_SRC;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

export function requestAd(el: HTMLElement) {
  if (el.dataset.adRequested) return;
  el.dataset.adRequested = 'true';
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (err) {
    console.warn('adsbygoogle push failed', err);
  }
}

function matches(query: string) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return match;
}
