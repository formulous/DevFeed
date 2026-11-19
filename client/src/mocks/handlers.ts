import { http, HttpResponse } from 'msw';
import type { Me, PostSummary } from '@/api/types';
import { resetAdminState } from './adminFixtures';
import { adminHandlers } from './adminHandlers';
import { mockPosts, mockSources, mockTags } from './fixtures';

const MOCK_TOKEN = 'mock-access-token';

const state = {
  loggedIn: false,
  me: null as Me | null,
  bookmarks: new Set<number>(),
  reads: new Set<number>(),
};

export function resetMockState() {
  state.loggedIn = false;
  state.me = null;
  state.bookmarks.clear();
  state.reads.clear();
  resetAdminState();
}

function adminGuard(request: Request) {
  if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요함');
  if (state.me?.role !== 'ADMIN') return error(403, 'FORBIDDEN', '관리자만 접근할 수 있음');
  return null;
}

function isMember(request: Request) {
  return request.headers.get('Authorization') === `Bearer ${MOCK_TOKEN}`;
}

function idList(value: string | null) {
  return value ? value.split(',').map(Number) : [];
}

function decorate(post: PostSummary, member: boolean): PostSummary {
  return member ? { ...post, isBookmarked: state.bookmarks.has(post.id), isRead: state.reads.has(post.id) } : post;
}

const error = (status: number, code: string, message: string) => HttpResponse.json({ code, message }, { status });

export const handlers = [
  http.get('*/api/posts', ({ request }) => {
    const url = new URL(request.url);
    const tagIds = idList(url.searchParams.get('tagIds'));
    const sourceIds = idList(url.searchParams.get('sourceIds'));
    const sourceType = url.searchParams.get('sourceType');
    const size = Math.min(Number(url.searchParams.get('size') ?? 20), 50);
    const cursor = url.searchParams.get('cursor');
    const offset = cursor ? Number(atob(cursor)) : 0;
    if (Number.isNaN(offset)) return error(400, 'INVALID_CURSOR', '커서를 해석할 수 없음');

    const filtered = mockPosts.filter(
      (p) =>
        (tagIds.length === 0 || p.tags.some((t) => tagIds.includes(t.id))) &&
        (sourceIds.length === 0 || sourceIds.includes(p.source.id)) &&
        (!sourceType || p.source.type === sourceType),
    );
    const member = isMember(request);
    const items = filtered.slice(offset, offset + size).map((p) => decorate(p, member));
    const next = offset + size;
    return HttpResponse.json({ items, nextCursor: next < filtered.length ? btoa(String(next)) : null });
  }),

  http.get('*/api/posts/popular', ({ request }) => {
    const period = new URL(request.url).searchParams.get('period');
    const hours = { DAY: 24, WEEK: 24 * 7, MONTH: 24 * 30 }[period ?? ''];
    if (!hours) return error(400, 'VALIDATION_FAILED', '기간 값이 올바르지 않음');
    const latest = Date.parse(mockPosts[0].publishedAt);
    const member = isMember(request);
    const items = mockPosts
      .filter((p) => latest - Date.parse(p.publishedAt) <= hours * 3_600_000)
      .map((p) => ({ ...decorate(p, member), viewCount: p.id % 9 === 0 ? 0 : ((p.id * 37) % 500) + p.id }))
      .filter((p) => p.viewCount >= 1)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 20);
    return HttpResponse.json({ items });
  }),

  http.get('*/api/search', ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 2 || q.length > 50) {
      return HttpResponse.json(
        { code: 'VALIDATION_FAILED', message: '검색어는 2~50자여야 함', fieldErrors: [{ field: 'q', message: '2~50자' }] },
        { status: 400 },
      );
    }
    const terms = q.toLowerCase().split(/\s+/);
    const tagIds = idList(url.searchParams.get('tagIds'));
    const sourceIds = idList(url.searchParams.get('sourceIds'));
    const days = { '1W': 7, '1M': 30, '1Y': 365 }[url.searchParams.get('period') ?? ''];
    const latest = Date.parse(mockPosts[0].publishedAt);
    const page = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('size') ?? 20);
    const member = isMember(request);
    const scored = mockPosts
      .map((p) => {
        const title = p.title.toLowerCase();
        const body = [p.summary ?? '', p.source.name, ...p.tags.map((t) => t.name)].join(' ').toLowerCase();
        const hit = terms.every((t) => title.includes(t) || body.includes(t));
        return { p, hit, score: terms.filter((t) => title.includes(t)).length * 2 + terms.filter((t) => body.includes(t)).length };
      })
      .filter(
        ({ p, hit }) =>
          hit &&
          (tagIds.length === 0 || p.tags.some((t) => tagIds.includes(t.id))) &&
          (sourceIds.length === 0 || sourceIds.includes(p.source.id)) &&
          (!days || latest - Date.parse(p.publishedAt) <= days * 86_400_000),
      );
    if (url.searchParams.get('sort') !== 'LATEST') scored.sort((a, b) => b.score - a.score);
    const items = scored.slice((page - 1) * size, page * size).map(({ p }) => decorate(p, member));
    return HttpResponse.json({
      items,
      total: Math.min(scored.length, 1000),
      totalCapped: scored.length > 1000,
      page,
      size,
    });
  }),

  http.get('*/api/tags', () => HttpResponse.json({ items: mockTags })),
  http.get('*/api/sources', () => HttpResponse.json({ items: mockSources })),

  http.post('*/api/posts/:id/views', ({ request, params }) => {
    if (isMember(request)) state.reads.add(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.put('*/api/me/bookmarks/:id', ({ request, params }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요함');
    state.bookmarks.add(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete('*/api/me/bookmarks/:id', ({ request, params }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요함');
    state.bookmarks.delete(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password === 'locked') {
      return HttpResponse.json(
        { code: 'LOGIN_LOCKED', message: '로그인 시도가 많아 잠겼음', retryAfterSec: 600 },
        { status: 423 },
      );
    }
    if (!body.email || body.password === 'wrong') return error(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 맞지 않음');
    state.loggedIn = true;
    state.me = {
      id: 1,
      email: body.email,
      nickname: body.email.split('@')[0],
      role: body.email.startsWith('admin') ? 'ADMIN' : 'USER',
      hasInterestTags: false,
      onboardingCompleted: body.email.startsWith('admin'),
      createdAt: new Date().toISOString(),
    };
    return HttpResponse.json({ accessToken: MOCK_TOKEN, expiresIn: 900, user: state.me });
  }),
  http.post('*/api/auth/refresh', () =>
    state.loggedIn && state.me
      ? HttpResponse.json({ accessToken: MOCK_TOKEN, expiresIn: 900, user: state.me })
      : error(401, 'REFRESH_TOKEN_INVALID', '다시 로그인해야 함'),
  ),
  http.post('*/api/auth/logout', () => {
    state.loggedIn = false;
    state.me = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/me', ({ request }) =>
    isMember(request) && state.me ? HttpResponse.json(state.me) : error(401, 'UNAUTHENTICATED', '로그인이 필요함'),
  ),
  ...adminHandlers(adminGuard),
];
