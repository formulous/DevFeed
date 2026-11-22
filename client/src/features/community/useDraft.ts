import { useCallback, useEffect, useRef } from 'react';
import type { CommunityPostInput } from '@/api/types';

const PREFIX = 'devfeed:community-draft';

export const draftKey = (userId: number, postId: number | null) => `${PREFIX}:${userId}:${postId ?? 'new'}`;

export function readDraft(key: string): CommunityPostInput | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CommunityPostInput>;
    if (typeof v.title !== 'string' || typeof v.body !== 'string' || typeof v.category !== 'string') return null;
    return { category: v.category, title: v.title, body: v.body, tagIds: Array.isArray(v.tagIds) ? v.tagIds : [] };
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}

export function useDraftSaver(key: string | null, value: CommunityPostInput, dirty: boolean, delay = 1000) {
  const latest = useRef(value);
  latest.current = value;

  const flush = useCallback(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
    } catch {
      return;
    }
  }, [key]);

  useEffect(() => {
    if (!key || !dirty) return;
    const t = setTimeout(flush, delay);
    return () => clearTimeout(t);
  }, [key, dirty, value, delay, flush]);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      flush();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty, flush]);
}
