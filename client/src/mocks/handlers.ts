import { categoryLabel } from '@/lib/categories';
import { http, HttpResponse } from 'msw';
import type { Me, PostSummary } from '@/api/types';
import { resetAdminState } from './adminFixtures';
import { adminHandlers } from './adminHandlers';
import { passkeyHandlers, resetPasskeys, setPasskeyPassword } from './passkeys';
import { myActivity, reactionFields, reactionHandlers, resetReactions, withdrawReactions } from './reactions';
import { gradeRef, profileHandlers, profileScore, resetProfile, scoreRead } from './profile';
import { fieldByApi } from '@/lib/fields';
import { communityCardById, communityHandlers, myCommunityActivity, recordCommunityView, resetCommunity, withdrawCommunity } from './community';
import { isClosedPost, isCommunityPost } from './communityStore';
import { mockExtraSources, mockNewsPosts, mockNewsSources, mockPosts, mockSources, mockTags } from './fixtures';

const MOCK_TOKEN = 'mock-access-token';

export const TAKEN_EMAIL = 'taken@devfeed.dev';
const BOOKMARK_LIMIT = 5000;

const state = {
  loggedIn: false,
  me: null as Me | null,
  password: '',
  bookmarks: new Map<number, string>(),
  reads: new Map<number, string>(),
  interestTags: [] as number[],
  recClicks: [] as { postId: number; recommendationId: string }[],
};

export const mockState = state;

export function resetMockState() {
  state.loggedIn = false;
  state.me = null;
  state.password = '';
  state.bookmarks.clear();
  state.reads.clear();
  state.interestTags = [];
  state.recClicks = [];
  resetAdminState();
  resetReactions();
  resetPasskeys();
  resetProfile();
  resetCommunity();
}

function activityCounts() {
  const activity = state.me ? myActivity(state.me.id) : { likes: 0, comments: 0, scoredComments: 0 };
  const posts = state.me ? myCommunityActivity(state.me.id) : { posts: 0, scoredPosts: 0 };
  return { ...activity, ...posts, reads: state.reads.size, bookmarks: state.bookmarks.size };
}

function startSession(me: Me, password: string, status = 200) {
  state.loggedIn = true;
  state.me = me;
  state.password = password;
  setPasskeyPassword(password);
  return HttpResponse.json({ accessToken: MOCK_TOKEN, expiresIn: 900, user: me }, { status });
}

function cursorPage<T>(list: T[], url: URL) {
  const size = Math.min(Number(url.searchParams.get('size') ?? 20), 50);
  const cursor = url.searchParams.get('cursor');
  const offset = cursor ? Number(atob(cursor)) : 0;
  const next = offset + size;
  return { items: list.slice(offset, next), nextCursor: next < list.length ? btoa(String(next)) : null };
}

const postById = (id: number) => mockPosts.find((p) => p.id === id) ?? mockNewsPosts.find((p) => p.id === id);

function fieldFilter(value: string | null) {
  const field = fieldByApi(value);
  if (!field) return () => true;
  const ids = new Set(mockTags.filter((t) => t.category && field.categories.includes(categoryLabel(t.category))).map((t) => t.id));
  return (p: PostSummary) => p.tags.some((t) => ids.has(t.id));
}
const byDateDesc = (m: Map<number, string>) => [...m.entries()].sort((a, b) => b[1].localeCompare(a[1]));

function adminGuard(request: Request) {
  if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
  if (state.me?.role !== 'ADMIN') return error(403, 'FORBIDDEN', '관리자만 접근할 수 있어요');
  return null;
}

function isMember(request: Request) {
  return request.headers.get('Authorization') === `Bearer ${MOCK_TOKEN}`;
}

function idList(value: string | null) {
  return value ? value.split(',').map(Number) : [];
}

export const mockViewCount = (id: number) => (id % 9 === 0 ? 0 : ((id * 37) % 500) + id);

const POPULAR_WEEK_IDS = (() => {
  const latest = Date.parse(mockPosts[0].publishedAt);
  return new Set(
    mockPosts
      .filter((p) => latest - Date.parse(p.publishedAt) <= 7 * 86_400_000 && mockViewCount(p.id) >= 1)
      .sort((a, b) => mockViewCount(b.id) - mockViewCount(a.id))
      .slice(0, 20)
      .map((p) => p.id),
  );
})();

function decorate(post: PostSummary, member: boolean): PostSummary {
  const base = { ...post, isPopular: POPULAR_WEEK_IDS.has(post.id), ...reactionFields(post.id, member) };
  return member ? { ...base, isBookmarked: state.bookmarks.has(post.id), isRead: state.reads.has(post.id) } : base;
}

const error = (status: number, code: string, message: string) => HttpResponse.json({ code, message }, { status });

const cardFor = (id: number, request: Request) => {
  if (isCommunityPost(id)) return communityCardById(id, request);
  const post = postById(id);
  return post ? decorate(post, true) : null;
};

export const handlers = [
  ...communityHandlers({
    isMember,
    me: () => state.me,
    error,
    myGrade: () => gradeRef(profileScore(activityCounts())),
    isBookmarked: (id) => state.bookmarks.has(id),
    isRead: (id) => state.reads.has(id),
  }),
  ...reactionHandlers({ isMember, me: () => state.me, error, myGrade: () => gradeRef(profileScore(activityCounts())) }),
  ...profileHandlers({ isMember, me: () => state.me, error, counts: activityCounts }),
  ...passkeyHandlers({ isMember, me: () => state.me, startSession: (me, password) => startSession(me, password), error }),
  http.get('*/api/posts', ({ request }) => {
    const url = new URL(request.url);
    const tagIds = idList(url.searchParams.get('tagIds'));
    const sourceIds = idList(url.searchParams.get('sourceIds'));
    const sourceType = url.searchParams.get('sourceType');
    const size = Math.min(Number(url.searchParams.get('size') ?? 20), 50);
    const cursor = url.searchParams.get('cursor');
    const offset = cursor ? Number(atob(cursor)) : 0;
    if (Number.isNaN(offset)) return error(400, 'INVALID_CURSOR', '커서를 해석할 수 없어요');

    const inField = fieldFilter(url.searchParams.get('field'));
    const filtered = mockPosts.filter(
      (p) =>
        inField(p) &&
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
    const url = new URL(request.url);
    const period = url.searchParams.get('period');
    const inField = fieldFilter(url.searchParams.get('field'));
    const hours = { DAY: 24, WEEK: 24 * 7, MONTH: 24 * 30 }[period ?? ''];
    if (!hours) return error(400, 'VALIDATION_FAILED', '기간 값이 올바르지 않아요');
    const latest = Date.parse(mockPosts[0].publishedAt);
    const member = isMember(request);
    const items = mockPosts
      .filter((p) => latest - Date.parse(p.publishedAt) <= hours * 3_600_000 && inField(p))
      .map((p) => ({ ...decorate(p, member), viewCount: mockViewCount(p.id) }))
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

  http.get('*/api/security-news/sources', () => HttpResponse.json({ items: mockNewsSources })),

  http.get('*/api/security-news/popular', ({ request }) => {
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some((k) => k !== 'period' && k !== 'region')) {
      return error(400, 'VALIDATION_FAILED', '요청 값이 올바르지 않아요');
    }
    const hours = { DAY: 24, WEEK: 24 * 7, MONTH: 24 * 30 }[url.searchParams.get('period') ?? ''];
    if (!hours) return error(400, 'VALIDATION_FAILED', '기간 값이 올바르지 않아요');
    const region = url.searchParams.get('region');
    if (region && region !== 'DOMESTIC' && region !== 'OVERSEAS') return error(400, 'VALIDATION_FAILED', '지역 값이 올바르지 않아요');
    const regionOf = new Map(mockNewsSources.map((s) => [s.id, s.region]));
    const latest = Math.max(...mockNewsPosts.map((p) => Date.parse(p.publishedAt)));
    const member = isMember(request);
    const items = mockNewsPosts
      .filter((p) => latest - Date.parse(p.publishedAt) <= hours * 3_600_000 && (!region || regionOf.get(p.source.id) === region))
      .map((p) => ({ ...decorate(p, member), isPopular: false, viewCount: mockViewCount(p.id) }))
      .filter((p) => p.viewCount >= 1)
      .sort((a, b) => b.viewCount - a.viewCount || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 20);
    return HttpResponse.json({ items });
  }),

  http.get('*/api/security-news', ({ request }) => {
    const url = new URL(request.url);
    const region = url.searchParams.get('region');
    const sourceIds = idList(url.searchParams.get('sourceIds'));
    if (region && region !== 'DOMESTIC' && region !== 'OVERSEAS') return error(400, 'VALIDATION_FAILED', '지역 값이 올바르지 않아요');
    const regionOf = new Map(mockNewsSources.map((s) => [s.id, s.region]));
    const member = isMember(request);
    const list = mockNewsPosts
      .filter(
        (p) =>
          (!region || regionOf.get(p.source.id) === region) &&
          (sourceIds.length === 0 || sourceIds.includes(p.source.id)),
      )
      .map((p) => ({ ...decorate(p, member), isPopular: false }));
    return HttpResponse.json(cursorPage(list, url));
  }),

  http.get('*/api/tags', () => HttpResponse.json({ items: mockTags })),
  http.get('*/api/sources', () =>
    HttpResponse.json({
      items: [...mockSources, ...mockExtraSources].map((s) => ({
        ...s,
        postCount: mockPosts.filter((p) => p.source.id === s.id).length,
        recentPostCount: Math.max(0, mockPosts.filter((p) => p.source.id === s.id).length - (s.id % 4)),
      })),
    }),
  ),

  http.post('*/api/posts/:id/views', async ({ request, params }) => {
    if (isCommunityPost(Number(params.id))) {
      if (isClosedPost(Number(params.id))) return new HttpResponse(null, { status: 204 });
      recordCommunityView(Number(params.id));
    }
    if (isMember(request)) {
      state.reads.set(Number(params.id), new Date().toISOString());
      scoreRead(Number(params.id));
    }
    const body = (await request.json().catch(() => null)) as { recommendationId?: string } | null;
    if (body?.recommendationId) state.recClicks.push({ postId: Number(params.id), recommendationId: body.recommendationId });
    return new HttpResponse(null, { status: 204 });
  }),

  http.put('*/api/me/bookmarks/:id', ({ request, params }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const id = Number(params.id);
    if (!postById(id) && !isCommunityPost(id)) return error(404, 'NOT_FOUND', '글을 찾을 수 없어요');
    if (isClosedPost(id)) return error(409, 'COMMUNITY_POST_CLOSED', '숨겨졌거나 삭제된 글이에요');
    if (!state.bookmarks.has(id) && state.bookmarks.size >= BOOKMARK_LIMIT) {
      return error(422, 'BOOKMARK_LIMIT_EXCEEDED', '북마크는 최대 5,000개');
    }
    if (!state.bookmarks.has(id)) state.bookmarks.set(id, new Date().toISOString());
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete('*/api/me/bookmarks/:id', ({ request, params }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    state.bookmarks.delete(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password === 'locked') {
      return HttpResponse.json(
        { code: 'LOGIN_LOCKED', message: '로그인 시도가 많아 잠겼어요', retryAfterSec: 600 },
        { status: 423 },
      );
    }
    if (!body.email || body.password === 'wrong') return error(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 맞지 않아요');
    return startSession(
      {
        id: 1,
        email: body.email,
        nickname: body.email.split('@')[0],
        role: body.email.startsWith('admin') ? 'ADMIN' : 'USER',
        hasInterestTags: false,
        onboardingCompleted: body.email.startsWith('admin'),
        createdAt: body.email.startsWith('new') ? new Date().toISOString() : '2026-01-01T00:00:00.000Z',
      },
      body.password,
    );
  }),
  http.post('*/api/auth/refresh', () =>
    state.loggedIn && state.me
      ? HttpResponse.json({ accessToken: MOCK_TOKEN, expiresIn: 900, user: state.me })
      : error(401, 'REFRESH_TOKEN_INVALID', '다시 로그인해 주세요'),
  ),
  http.post('*/api/auth/logout', () => {
    state.loggedIn = false;
    state.me = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/me', ({ request }) =>
    isMember(request) && state.me ? HttpResponse.json(state.me) : error(401, 'UNAUTHENTICATED', '로그인이 필요해요'),
  ),
  http.post('*/api/auth/signup', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; nickname: string };
    if (body.email === TAKEN_EMAIL) return error(409, 'EMAIL_DUPLICATED', '이미 가입된 이메일이에요');
    return startSession(
      {
        id: 2,
        email: body.email,
        nickname: body.nickname,
        role: 'USER',
        hasInterestTags: false,
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      },
      body.password,
      201,
    );
  }),
  http.patch('*/api/me', async ({ request }) => {
    if (!isMember(request) || !state.me) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const { nickname } = (await request.json()) as { nickname: string };
    state.me = { ...state.me, nickname };
    return HttpResponse.json(state.me);
  }),
  http.post('*/api/me/withdraw', async ({ request }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const { password } = (await request.json()) as { password: string };
    if (password !== state.password) return error(403, 'PASSWORD_MISMATCH', '비밀번호가 맞지 않아요');
    if (state.me) {
      withdrawReactions(state.me.id);
      withdrawCommunity(state.me.id);
    }
    resetMockState();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('*/api/me/onboarding/complete', ({ request }) => {
    if (!isMember(request) || !state.me) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    state.me = { ...state.me, onboardingCompleted: true };
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/me/interest-tags', ({ request }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    return HttpResponse.json({ items: state.interestTags.map((id) => ({ id, name: mockTags.find((t) => t.id === id)!.name })) });
  }),
  http.put('*/api/me/interest-tags', async ({ request }) => {
    if (!isMember(request) || !state.me) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const { tagIds } = (await request.json()) as { tagIds: number[] };
    if (tagIds.length < 3 || tagIds.length > 10 || tagIds.some((id) => !mockTags.some((t) => t.id === id))) {
      return HttpResponse.json(
        { code: 'VALIDATION_FAILED', message: '관심 태그는 3~10개', fieldErrors: [{ field: 'tagIds', message: '3~10개' }] },
        { status: 400 },
      );
    }
    state.interestTags = tagIds;
    state.me = { ...state.me, hasInterestTags: true, onboardingCompleted: true };
    return HttpResponse.json({ items: tagIds.map((id) => ({ id, name: mockTags.find((t) => t.id === id)!.name })) });
  }),
  http.get('*/api/me/bookmarks', ({ request }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const url = new URL(request.url);
    const tagIds = idList(url.searchParams.get('tagIds'));
    const list = byDateDesc(state.bookmarks)
      .flatMap(([id, at]) => {
        const card = cardFor(id, request);
        return card ? [{ ...card, bookmarkedAt: at }] : [];
      })
      .filter((p) => tagIds.length === 0 || p.tags.some((t) => tagIds.includes(t.id)));
    const total = byDateDesc(state.bookmarks).filter(([id]) => cardFor(id, request)).length;
    return HttpResponse.json({ ...cursorPage(list, url), total });
  }),
  http.get('*/api/me/history', ({ request }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const list = byDateDesc(state.reads).flatMap(([id, at]) => {
      const card = cardFor(id, request);
      return card ? [{ ...card, readAt: at }] : [];
    });
    return HttpResponse.json(cursorPage(list, new URL(request.url)));
  }),
  http.delete('*/api/me/history/:id', ({ request, params }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    state.reads.delete(Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete('*/api/me/history', ({ request }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    state.reads.clear();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/recommendations', ({ request }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    if (cursor === 'expired') return error(400, 'INVALID_CURSOR', '커서 값이 올바르지 않아요');
    const fallback = state.interestTags.length === 0 && state.bookmarks.size === 0 && state.reads.size === 0;
    const interestNames = new Map(state.interestTags.map((id) => [id, mockTags.find((t) => t.id === id)!.name]));
    const candidates = mockPosts
      .filter((p) => !state.reads.has(p.id))
      .map((p) => {
        const matched = p.tags.filter((t) => interestNames.has(t.id));
        const reasons = fallback || matched.length === 0
          ? [{ type: 'POPULAR' as const }]
          : matched.slice(0, 2).map((t) => ({ type: 'INTEREST_TAG' as const, tagName: t.name }));
        return { post: { ...decorate(p, true), reasons }, score: matched.length };
      })
      .filter((c) => fallback || c.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((c) => c.post);
    return HttpResponse.json({ ...cursorPage(candidates, url), recommendationId: crypto.randomUUID(), fallback });
  }),
  ...adminHandlers(adminGuard),
];
