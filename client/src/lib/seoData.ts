import { matchPath } from 'react-router';
import type { QueryClient } from '@tanstack/react-query';
import type { CommunityPost } from '@/api/types';
import { communityPostKey } from '@/features/community/queries';

let cached: { id: number; post: CommunityPost } | null | undefined;

export function readSeoPost(pathname: string = window.location.pathname) {
  if (cached !== undefined) return cached;
  cached = null;
  const id = Number(matchPath('/community/posts/:id', pathname)?.params.id);
  const el = document.getElementById('seo-data');
  if (!Number.isInteger(id) || !el?.textContent) return cached;
  try {
    const post = JSON.parse(el.textContent) as CommunityPost;
    if (post && post.id === id && post.kind === 'COMMUNITY') cached = { id, post };
  } catch {
    cached = null;
  }
  return cached;
}

export function seoPostPlaceholder(id: number) {
  const seed = cached;
  return seed && seed.id === id ? seed.post : undefined;
}

export function seedSeoPost(client: QueryClient, pathname?: string) {
  const seed = readSeoPost(pathname);
  if (seed) client.setQueryData(communityPostKey(seed.id, 'guest'), seed.post);
}

export function resetSeoPost() {
  cached = undefined;
}
