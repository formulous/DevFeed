import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { canonicalFor, isNoindex, robotsFor } from '@/components/layout/RouteTitle';
import { plainExcerpt } from '@/lib/excerpt';
import { routesManifest, SEO_ROUTES } from '@/lib/seoRoutes';
import { SOLVED_POST_ID } from '@/mocks/communityStore';
import { renderWithApp } from './render';

const head = (key: string) => document.head.querySelector(`[data-seo="${key}"]`);

function routePaths(file: string, prefix: string) {
  const src = readFileSync(join(process.cwd(), 'src', file), 'utf8');
  return [...src.matchAll(/<Route\s+(index|path="([^"]+)")/g)]
    .map((m) => (m[1] === 'index' ? prefix || '/' : m[2]))
    .filter((p) => p !== '*' && p !== 'admin/*')
    .map((p) => (p.startsWith('/') ? p : `${prefix}/${p}`));
}

describe('경로 원천(routes.json)', () => {
  it('App·관리자 라우트와 경로 표가 같음', () => {
    const app = [...routePaths('App.tsx', ''), ...routePaths('features/admin/AdminRoutes.tsx', '/admin')];
    expect(new Set(SEO_ROUTES.map((r) => r.pattern))).toEqual(new Set(app));
  });

  it('항목마다 제목·설명·robots·canonical이 있음', () => {
    const m = routesManifest();
    for (const r of [...m.routes, m.notFound]) {
      for (const f of ['pattern', 'title', 'description', 'robots', 'canonical'] as const) expect(typeof r[f]).toBe('string');
    }
  });

  it('robots·canonical 규칙', () => {
    for (const p of ['/login', '/signup', '/onboarding/tags', '/me/bookmarks', '/admin', '/admin/sources/3/edit', '/community/new', '/tech/for-you']) {
      expect(robotsFor(p)).toBe('noindex, nofollow');
    }
    expect(robotsFor('/search')).toBe('noindex, follow');
    expect(robotsFor('/nope')).toBe('noindex, follow');
    for (const p of ['/tech', '/tech/popular', '/security', '/community', '/community/likes', '/community/posts/7', '/privacy']) expect(isNoindex(p)).toBe(false);
    expect(canonicalFor('/tech/comments')).toBe('https://formulous.org/tech');
    expect(canonicalFor('/security/popular')).toBe('https://formulous.org/security');
    expect(canonicalFor('/community/likes')).toBe('https://formulous.org/community');
    expect(canonicalFor('/community/posts/7')).toBe('https://formulous.org/community/posts/7');
    expect(canonicalFor('/')).toBe('https://formulous.org/tech');
    expect(canonicalFor('/nope')).toBe('');
  });
});

describe('머리말 갱신', () => {
  it('정렬 화면은 기본 목록 canonical, 쿼리는 뺌', async () => {
    renderWithApp(<App />, '/community/likes?category=QUESTION');
    await waitFor(() => expect(head('canonical')).toHaveAttribute('href', 'https://formulous.org/community'));
    expect(head('og:url')).toHaveAttribute('content', 'https://formulous.org/community');
    expect(head('robots')).toHaveAttribute('content', 'index, follow');
    expect(head('title')?.textContent).toBe('좋아요 많은 자유 게시판 글 · formulous');
  });

  it('비공개·검색 화면 robots', async () => {
    renderWithApp(<App />, '/login');
    await waitFor(() => expect(head('robots')).toHaveAttribute('content', 'noindex, nofollow'));
    renderWithApp(<App />, '/search?q=kafka');
    await waitFor(() => expect(head('robots')).toHaveAttribute('content', 'noindex, follow'));
    expect(head('canonical')).toHaveAttribute('href', 'https://formulous.org/search');
  });

  it('글 상세는 글 제목·본문 요약·article', async () => {
    renderWithApp(<App />, `/community/posts/${SOLVED_POST_ID}`);
    await screen.findByRole('heading', { level: 1, name: 'Kafka 컨슈머 랙이 계속 쌓여요' });
    await waitFor(() => expect(document.title).toBe('Kafka 컨슈머 랙이 계속 쌓여요 · formulous'));
    expect(head('og:type')).toHaveAttribute('content', 'article');
    expect(head('description')?.getAttribute('content')?.length).toBeGreaterThan(0);
    expect(head('canonical')).toHaveAttribute('href', `https://formulous.org/community/posts/${SOLVED_POST_ID}`);
  });

  it('없는 글은 noindex', async () => {
    renderWithApp(<App />, '/community/posts/987654');
    await screen.findByText('글을 찾을 수 없어요');
    await waitFor(() => expect(head('robots')).toHaveAttribute('content', 'noindex, follow'));
    expect(document.title).toBe('글을 찾을 수 없어요 · formulous');
  });

  it('첫 화면에서는 server가 넣은 다른 data-seo 태그를 그대로 둠', async () => {
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.dataset.seo = 'jsonld';
    document.head.appendChild(ld);
    const { unmount } = renderWithApp(<App />, '/tech');
    await waitFor(() => expect(document.title).toBe('최신 기술 글 · formulous'));
    expect(head('jsonld')).not.toBeNull();
    unmount();
    ld.remove();
  });
});

describe('plainExcerpt', () => {
  it('마크다운 기호를 빼고 120자로 자름', () => {
    expect(plainExcerpt('# 제목\n\n**굵게** [링크](https://x.y) `code`\n```\nblock\n```')).toBe('제목 굵게 링크 code');
    const long = plainExcerpt('가'.repeat(200));
    expect(long).toHaveLength(121);
    expect(long.endsWith('…')).toBe(true);
  });
});
