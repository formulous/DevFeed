import { http, HttpResponse } from 'msw';
import type { Me, PostSummary } from '@/api/types';
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
    if (!body.email || !body.password) return error(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 맞지 않음');
    state.loggedIn = true;
    state.me = {
      id: 1,
      email: body.email,
      nickname: body.email.split('@')[0],
      role: body.email.startsWith('admin') ? 'ADMIN' : 'USER',
      hasInterestTags: false,
      onboardingCompleted: false,
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
];
