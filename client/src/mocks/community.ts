import { http, HttpResponse } from 'msw';
import type {
  CommunityCategory,
  CommunityPost,
  GradeRef,
  Me,
  PostSummary,
  ReportReason,
  ReportTarget,
  ReportTargetType,
} from '@/api/types';
import {
  community,
  COMMUNITY_SEED_START,
  MY_POST_ID,
  reportKey,
  reportedBy,
  SOLVED_POST_ID,
  XSS_POST_ID,
  type MockCommunityPost,
  type MockReportTarget,
} from './communityStore';
import { mockTags } from './fixtures';
import { seedAuthorGrade } from './profile';
import { commentAuthorOf, commentCount, commentPreview, hideCommentByReports, reactionFields, showComment } from './reactions';

export const COMMUNITY_SOURCE = { id: 999, name: 'DevFeed 커뮤니티', logoUrl: null, type: 'COMPANY' as const };
export const DAILY_POST_LIMIT = 5;
export const POST_COOLDOWN_MS = 60_000;
export const NEW_ACCOUNT_MS = 24 * 3_600_000;
export const DAILY_POST_SCORE_CAP = 3;
const AUTO_HIDE = 3;
export const PENDING_REPORT_POST_ID = 5010;
export const HIDDEN_REPORT_POST_ID = 5012;

const NAMES = ['백엔드곰', '리액트러', '데이터쟁이', '인프라맨', '코틀린팬'];
const CATS: CommunityCategory[] = ['QUESTION', 'DISCUSSION', 'SHARE'];

const SEED_TITLES = [
  'Kafka 컨슈머 랙이 계속 쌓여요',
  '모노레포 vs 멀티레포, 팀 규모별 경험 나눠요',
  'Spring Boot 3 마이그레이션 체크리스트 공유',
  'XSS 문자열이 든 글 (안전하게 보여야 해요)',
  'React 상태 관리 라이브러리 고르는 기준이 궁금해요',
  '코드 리뷰 문화 어떻게 만드셨나요',
  '내가 쓴 첫 글이에요',
  'Redis 캐시 TTL 전략 정리',
];

const CODE_BODY = [
  '컨슈머 그룹 하나에 파티션 12개인데 **랙이 계속 늘어요**.',
  '',
  '```java',
  'props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500);',
  'props.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, 10_000);',
  '```',
  '',
  '- 처리 시간은 건당 20ms 정도예요',
  '- `max.poll.interval.ms`는 기본값이에요',
  '',
  '| 설정 | 값 |',
  '|---|---|',
  '| partitions | 12 |',
  '| consumers | 4 |',
].join('\n');

export const XSS_BODY = [
  '<script>window.__xss = 1</script>',
  '',
  '<img src=x onerror="window.__xss = 2">',
  '',
  '[눌러 보세요](javascript:window.__xss=3)',
  '',
  '<a href="https://evil.example" onclick="window.__xss=4">raw a</a>',
  '',
  '<iframe src="https://evil.example"></iframe>',
  '',
  '![추적 이미지](https://track.example/pixel.png)',
  '',
  '[정상 링크](https://example.com/docs)',
].join('\n');

function seedPosts() {
  community.posts.clear();
  const now = Date.now();
  for (let i = 0; i < 24; i++) {
    const id = COMMUNITY_SEED_START + 1 + i;
    const title = SEED_TITLES[i % SEED_TITLES.length];
    const authorIdx = i % NAMES.length;
    const mine = id === MY_POST_ID;
    const tagA = mockTags[i % 10];
    const p: MockCommunityPost = {
      id,
      userId: mine ? 1 : 900 + authorIdx,
      nickname: mine ? 'user' : NAMES[authorIdx],
      category: id === SOLVED_POST_ID ? 'QUESTION' : CATS[i % CATS.length],
      title: i < SEED_TITLES.length ? title : `${title} (${id})`,
      body: id === XSS_POST_ID ? XSS_BODY : i % 2 === 0 ? CODE_BODY : `${title}에 대한 이야기예요. 경험을 나눠 주세요.\n\n> 인용도 되고요\n\n1. 첫째\n2. 둘째`,
      tags: [{ id: tagA.id, name: tagA.name }],
      status: 'VISIBLE',
      hiddenReason: null,
      acceptedCommentId: id === SOLVED_POST_ID ? SOLVED_POST_ID * 1000 + 1 : null,
      createdAt: new Date(now - (i * 95 + 30) * 60_000).toISOString(),
      editedAt: i === 2 ? new Date(now - 10 * 60_000).toISOString() : null,
      viewCount: (i * 17) % 90,
      scored: false,
    };
    community.posts.set(id, p);
  }
}

export function resetCommunity() {
  seedPosts();
  community.reports.clear();
  community.writes = [];
  community.seq = 6000;
  seedReport('POST', PENDING_REPORT_POST_ID, [801, 802]);
  seedReport('POST', HIDDEN_REPORT_POST_ID, [801, 802, 803], 'ABUSE');
}

resetCommunity();

export function myCommunityActivity(userId: number) {
  let posts = 0;
  let scoredPosts = 0;
  for (const p of community.posts.values()) {
    if (p.userId !== userId) continue;
    if (p.status === 'VISIBLE') posts += 1;
    if (p.status === 'VISIBLE' && p.scored) scoredPosts += 1;
  }
  return { posts, scoredPosts };
}

export function withdrawCommunity(userId: number) {
  for (const p of community.posts.values()) if (p.userId === userId) softDelete(p);
  for (const r of community.reports.values()) r.reporters.delete(userId);
}

function softDelete(p: MockCommunityPost) {
  Object.assign(p, { status: 'DELETED', title: '', body: '', tags: [], userId: null, nickname: '', acceptedCommentId: null, hiddenReason: null });
}

const kstDay = (t: number) => new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);

export function writeStatus(user: Me, now = Date.now()) {
  if (user.role === 'ADMIN') return { allowed: true, reason: null, availableAt: null, retryAfterSec: null, remainingToday: null };
  const mine = community.writes.filter((w) => w.userId === user.id);
  const today = mine.filter((w) => kstDay(w.at) === kstDay(now));
  const blocks: { reason: 'NEW_ACCOUNT' | 'DAILY_LIMIT' | 'COOLDOWN'; until: number }[] = [];
  const joined = Date.parse(user.createdAt);
  if (now - joined < NEW_ACCOUNT_MS) blocks.push({ reason: 'NEW_ACCOUNT', until: joined + NEW_ACCOUNT_MS });
  if (today.length >= DAILY_POST_LIMIT) {
    const midnight = Date.parse(`${kstDay(now)}T00:00:00+09:00`) + 86_400_000;
    blocks.push({ reason: 'DAILY_LIMIT', until: midnight });
  }
  const last = mine.at(-1);
  if (last && now - last.at < POST_COOLDOWN_MS) blocks.push({ reason: 'COOLDOWN', until: last.at + POST_COOLDOWN_MS });
  const remainingToday = Math.max(0, DAILY_POST_LIMIT - today.length);
  if (blocks.length === 0) return { allowed: true, reason: null, availableAt: null, retryAfterSec: null, remainingToday };
  const worst = blocks.sort((a, b) => b.until - a.until)[0];
  return {
    allowed: false,
    reason: worst.reason,
    availableAt: new Date(worst.until).toISOString(),
    retryAfterSec: Math.max(1, Math.ceil((worst.until - now) / 1000)),
    remainingToday,
  };
}

function stripMarkdown(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

interface Ctx {
  isMember: (request: Request) => boolean;
  me: () => Me | null;
  error: (status: number, code: string, message: string) => Response;
  myGrade: () => GradeRef;
  isBookmarked: (id: number) => boolean;
  isRead: (id: number) => boolean;
}

let ctxRef: Ctx | null = null;

function viewer(request: Request) {
  const user = ctxRef && ctxRef.isMember(request) ? ctxRef.me() : null;
  return { user, userId: user?.id ?? null, admin: user?.role === 'ADMIN' };
}

function authorOf(p: MockCommunityPost, userId: number | null) {
  if (p.userId === null || p.status === 'DELETED') return null;
  const me = ctxRef?.me();
  const own = p.userId === userId && me;
  return {
    id: p.userId,
    nickname: own ? me.nickname : p.nickname || (me && p.userId === me.id ? me.nickname : '회원'),
    grade: own && ctxRef ? ctxRef.myGrade() : seedAuthorGrade(p.userId),
  };
}

export function communityCard(p: MockCommunityPost, member: boolean, userId: number | null): PostSummary {
  return {
    id: p.id,
    kind: 'COMMUNITY',
    title: p.title,
    summary: p.status === 'DELETED' ? null : stripMarkdown(p.body),
    url: `http://localhost:5175/community/posts/${p.id}`,
    thumbnailUrl: null,
    publishedAt: p.createdAt,
    source: COMMUNITY_SOURCE,
    tags: p.tags,
    isPopular: false,
    ...reactionFields(p.id, member),
    ...(member && ctxRef ? { isBookmarked: ctxRef.isBookmarked(p.id), isRead: ctxRef.isRead(p.id) } : {}),
    community: {
      category: p.category,
      author: authorOf(p, userId),
      editedAt: p.editedAt,
      solved: p.category === 'QUESTION' && p.acceptedCommentId !== null,
      viewCount: p.viewCount,
    },
  };
}

function detail(p: MockCommunityPost, request: Request): CommunityPost {
  const v = viewer(request);
  const card = communityCard(p, v.userId !== null, v.userId);
  return {
    ...card,
    kind: 'COMMUNITY',
    community: card.community!,
    body: p.status === 'DELETED' ? null : p.body,
    status: p.status,
    acceptedCommentId: p.acceptedCommentId,
    mine: p.status !== 'DELETED' && p.userId !== null && p.userId === v.userId,
    reportedByMe: reportedBy('POST', p.id, v.userId),
  };
}

export function communityCardById(id: number, request: Request) {
  const p = community.posts.get(id);
  if (!p || p.status !== 'VISIBLE') return null;
  const v = viewer(request);
  return communityCard(p, v.userId !== null, v.userId);
}

export function recordCommunityView(id: number) {
  const p = community.posts.get(id);
  if (p && p.status === 'VISIBLE') p.viewCount += 1;
}

function cursorPage<T>(list: T[], url: URL) {
  const size = Math.min(Number(url.searchParams.get('size') ?? 20), 50);
  const cursor = url.searchParams.get('cursor');
  const offset = cursor ? Number(atob(cursor)) : 0;
  const next = offset + size;
  return { items: list.slice(offset, next), nextCursor: next < list.length ? btoa(String(next)) : null };
}

const CATEGORY = new Set(['QUESTION', 'DISCUSSION', 'SHARE']);

function validatePost(body: Record<string, unknown>, partial: boolean) {
  const errors: { field: string; message: string }[] = [];
  if (!partial || body.category !== undefined) {
    if (typeof body.category !== 'string' || !CATEGORY.has(body.category)) errors.push({ field: 'category', message: '말머리를 골라 주세요' });
  }
  if (!partial || body.title !== undefined) {
    const t = typeof body.title === 'string' ? body.title.trim() : '';
    if (t.length < 2 || t.length > 100 || /\n/.test(t)) errors.push({ field: 'title', message: '제목은 2~100자로 입력해 주세요' });
  }
  if (!partial || body.body !== undefined) {
    const b = typeof body.body === 'string' ? body.body : '';
    const len = b.trim().length;
    if (len < 10 || len > 20_000) errors.push({ field: 'body', message: '본문은 10~20,000자로 입력해 주세요' });
    else if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(b)) errors.push({ field: 'body', message: '쓸 수 없는 문자가 들어 있어요' });
  }
  if (body.tagIds !== undefined) {
    const ids = body.tagIds;
    if (!Array.isArray(ids) || ids.length > 5 || new Set(ids).size !== ids.length || ids.some((id) => !mockTags.some((t) => t.id === id))) {
      errors.push({ field: 'tagIds', message: '태그는 5개까지 고를 수 있어요' });
    }
  }
  return errors;
}

const invalid = (fieldErrors: { field: string; message: string }[]) =>
  HttpResponse.json({ code: 'VALIDATION_FAILED', message: '입력값을 확인해 주세요', fieldErrors }, { status: 400 });

function tagsOf(ids: unknown) {
  return Array.isArray(ids) ? ids.map((id) => ({ id: id as number, name: mockTags.find((t) => t.id === id)!.name })) : [];
}

function previewOf(type: ReportTargetType, id: number) {
  if (type === 'POST') {
    const p = community.posts.get(id);
    if (!p || p.status === 'DELETED') return null;
    return {
      postId: p.id,
      preview: {
        title: p.title,
        text: stripMarkdown(p.body),
        author: p.userId === null ? null : { id: p.userId, nickname: p.nickname || '회원' },
        status: p.status === 'HIDDEN' ? ('HIDDEN' as const) : ('VISIBLE' as const),
        hiddenReason: p.hiddenReason,
      },
    };
  }
  const found = commentPreview(id);
  if (!found) return null;
  return {
    postId: found.postId,
    preview: {
      title: null,
      text: found.c.content.slice(0, 200),
      author: found.c.authorId === null ? null : { id: found.c.authorId, nickname: found.c.nickname },
      status: found.c.status === 'HIDDEN' ? ('HIDDEN' as const) : ('VISIBLE' as const),
      hiddenReason: found.c.status === 'HIDDEN' ? ('REPORTS' as const) : null,
    },
  };
}

function toReportTarget(r: MockReportTarget): ReportTarget | null {
  const info = previewOf(r.targetType, r.targetId);
  if (!info) return null;
  return {
    targetType: r.targetType,
    targetId: r.targetId,
    postId: info.postId,
    state: r.state,
    reportCount: Object.values(r.reasons).reduce((a, b) => a + b, 0),
    reasons: { ...r.reasons },
    details: r.details.slice(-5).reverse(),
    lastReportedAt: r.lastReportedAt,
    preview: info.preview,
  };
}

function hideTarget(type: ReportTargetType, id: number, reason: 'ADMIN' | 'REPORTS') {
  if (type === 'POST') {
    const p = community.posts.get(id);
    if (p && p.status === 'VISIBLE') Object.assign(p, { status: 'HIDDEN', hiddenReason: reason });
  } else {
    hideCommentByReports(id);
  }
}

function showTarget(type: ReportTargetType, id: number) {
  if (type === 'POST') {
    const p = community.posts.get(id);
    if (p && p.status === 'HIDDEN') Object.assign(p, { status: 'VISIBLE', hiddenReason: null });
  } else {
    showComment(id);
  }
}

export function seedReport(type: ReportTargetType, id: number, reporterIds: number[], reason: ReportReason = 'SPAM') {
  for (const rid of reporterIds) addReport(type, id, rid, reason);
}

function addReport(type: ReportTargetType, id: number, reporterId: number, reason: ReportReason, detail?: string) {
  const key = reportKey(type, id);
  let r = community.reports.get(key);
  if (!r) {
    r = { targetType: type, targetId: id, reporters: new Set(), reasons: { SPAM: 0, ABUSE: 0, PRIVACY: 0, OTHER: 0 }, details: [], state: 'PENDING', lastReportedAt: '' };
    community.reports.set(key, r);
  }
  if (r.reporters.has(reporterId)) return false;
  r.reporters.add(reporterId);
  r.reasons[reason] += 1;
  if (detail) r.details.push(detail);
  r.lastReportedAt = new Date().toISOString();
  if (r.state === 'PENDING' && r.reporters.size >= AUTO_HIDE) {
    r.state = 'HIDDEN';
    hideTarget(type, id, 'REPORTS');
  }
  return true;
}

export function communityHandlers(ctx: Ctx) {
  ctxRef = ctx;
  const { error } = ctx;
  const notFound = () => error(404, 'NOT_FOUND', '글을 찾을 수 없어요');
  const closed = () => error(409, 'COMMUNITY_POST_CLOSED', '숨겨졌거나 삭제된 글이에요');
  const visible = () => [...community.posts.values()].filter((p) => p.status === 'VISIBLE').sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  const categoryParam = (url: URL) => {
    const c = url.searchParams.get('category');
    if (c && !CATEGORY.has(c)) return { bad: true as const };
    return { bad: false as const, value: c };
  };

  const canSee = (p: MockCommunityPost, request: Request) => {
    const v = viewer(request);
    if (p.status === 'VISIBLE') return true;
    if (p.status === 'HIDDEN') return v.admin || (v.userId !== null && p.userId === v.userId);
    return commentCount(p.id) > 0;
  };

  return [
    http.get('*/api/community/posts', ({ request }) => {
      const url = new URL(request.url);
      const cat = categoryParam(url);
      if (cat.bad) return error(400, 'VALIDATION_FAILED', '말머리 값이 올바르지 않아요');
      const v = viewer(request);
      const list = visible()
        .filter((p) => !cat.value || p.category === cat.value)
        .map((p) => communityCard(p, v.userId !== null, v.userId));
      return HttpResponse.json(cursorPage(list, url));
    }),

    http.get('*/api/community/popular', ({ request }) => {
      const url = new URL(request.url);
      const hours = { DAY: 24, WEEK: 24 * 7, MONTH: 24 * 30 }[url.searchParams.get('period') ?? ''];
      if (!hours) return error(400, 'VALIDATION_FAILED', '기간 값이 올바르지 않아요');
      const cat = categoryParam(url);
      if (cat.bad) return error(400, 'VALIDATION_FAILED', '말머리 값이 올바르지 않아요');
      const v = viewer(request);
      const now = Date.now();
      const items = visible()
        .filter((p) => now - Date.parse(p.createdAt) <= hours * 3_600_000 && (!cat.value || p.category === cat.value))
        .map((p) => ({ ...communityCard(p, v.userId !== null, v.userId), viewCount: p.viewCount }))
        .map((p) => ({ p, score: (p.likeCount ?? 0) * 2 + (p.commentCount ?? 0) + p.viewCount * 0.1 }))
        .sort((a, b) => b.score - a.score || b.p.publishedAt.localeCompare(a.p.publishedAt))
        .slice(0, 20)
        .map(({ p }) => p);
      return HttpResponse.json({ items });
    }),

    http.get('*/api/community/write-status', ({ request }) => {
      const v = viewer(request);
      if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      return HttpResponse.json(writeStatus(v.user));
    }),

    http.post('*/api/community/posts', async ({ request }) => {
      const v = viewer(request);
      if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const body = (await request.json()) as Record<string, unknown>;
      const errors = validatePost(body, false);
      if (errors.length) return invalid(errors);
      const status = writeStatus(v.user);
      if (!status.allowed) {
        return HttpResponse.json(
          { code: 'POST_WRITE_LIMITED', message: '지금은 글을 쓸 수 없어요', reason: status.reason, retryAfterSec: status.retryAfterSec, availableAt: status.availableAt },
          { status: 429, headers: { 'Retry-After': String(status.retryAfterSec) } },
        );
      }
      const now = Date.now();
      const todayCount = community.writes.filter((w) => w.userId === v.user!.id && kstDay(w.at) === kstDay(now)).length;
      community.writes.push({ userId: v.user.id, at: now });
      const p: MockCommunityPost = {
        id: ++community.seq,
        userId: v.user.id,
        nickname: v.user.nickname,
        category: body.category as CommunityCategory,
        title: (body.title as string).trim(),
        body: body.body as string,
        tags: tagsOf(body.tagIds),
        status: 'VISIBLE',
        hiddenReason: null,
        acceptedCommentId: null,
        createdAt: new Date(now).toISOString(),
        editedAt: null,
        viewCount: 0,
        scored: todayCount < DAILY_POST_SCORE_CAP,
      };
      community.posts.set(p.id, p);
      return HttpResponse.json(detail(p, request), { status: 201 });
    }),

    http.get('*/api/community/posts/:id', ({ request, params }) => {
      const p = community.posts.get(Number(params.id));
      if (!p || !canSee(p, request)) return notFound();
      return HttpResponse.json(detail(p, request));
    }),

    http.patch('*/api/community/posts/:id', async ({ request, params }) => {
      const v = viewer(request);
      if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const p = community.posts.get(Number(params.id));
      if (!p || p.status === 'DELETED') return notFound();
      if (p.userId !== v.userId) return error(403, 'FORBIDDEN', '권한이 없어요');
      if (p.status === 'HIDDEN') return closed();
      const body = (await request.json()) as Record<string, unknown>;
      const errors = validatePost(body, true);
      if (errors.length) return invalid(errors);
      if (body.category !== undefined) p.category = body.category as CommunityCategory;
      if (body.title !== undefined) p.title = (body.title as string).trim();
      if (body.body !== undefined) p.body = body.body as string;
      if (body.tagIds !== undefined) p.tags = tagsOf(body.tagIds);
      if (p.category !== 'QUESTION') p.acceptedCommentId = null;
      p.editedAt = new Date().toISOString();
      return HttpResponse.json(detail(p, request));
    }),

    http.delete('*/api/community/posts/:id', ({ request, params }) => {
      const v = viewer(request);
      if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const p = community.posts.get(Number(params.id));
      if (!p || p.status === 'DELETED') return notFound();
      if (p.userId !== v.userId && !v.admin) return error(403, 'FORBIDDEN', '권한이 없어요');
      softDelete(p);
      return new HttpResponse(null, { status: 204 });
    }),

    ...([true, false] as const).map((accept) =>
      (accept ? http.put : http.delete)('*/api/community/posts/:id/accepted-comment', async ({ request, params }) => {
        const v = viewer(request);
        if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
        const p = community.posts.get(Number(params.id));
        if (!p || p.status === 'DELETED' || !canSee(p, request)) return notFound();
        if (p.userId !== v.userId) return error(403, 'FORBIDDEN', '권한이 없어요');
        if (accept) {
          if (p.status === 'HIDDEN') return closed();
          if (p.category !== 'QUESTION') return error(409, 'ACCEPT_NOT_QUESTION', '질문글만 채택할 수 있어요');
          const { commentId } = (await request.json()) as { commentId: number };
          const found = commentPreview(commentId);
          if (!found || found.postId !== p.id || found.c.status !== 'VISIBLE') return error(404, 'NOT_FOUND', '댓글을 찾을 수 없어요');
          if (found.c.parentId !== null) return error(409, 'ACCEPT_REPLY', '답글은 채택할 수 없어요');
          if (found.c.authorId === v.userId) return error(409, 'ACCEPT_OWN_COMMENT', '내 댓글은 채택할 수 없어요');
          p.acceptedCommentId = commentId;
        } else {
          p.acceptedCommentId = null;
        }
        return HttpResponse.json({ acceptedCommentId: p.acceptedCommentId, solved: p.category === 'QUESTION' && p.acceptedCommentId !== null });
      }),
    ),

    http.post('*/api/reports', async ({ request }) => {
      const v = viewer(request);
      if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const body = (await request.json()) as { targetType?: string; targetId?: number; reason?: string; detail?: string };
      const type = body.targetType as ReportTargetType;
      const reason = body.reason as ReportReason;
      const detailText = typeof body.detail === 'string' ? body.detail.trim() : undefined;
      if ((type !== 'POST' && type !== 'COMMENT') || !['SPAM', 'ABUSE', 'PRIVACY', 'OTHER'].includes(reason ?? '')) {
        return invalid([{ field: 'reason', message: '사유를 골라 주세요' }]);
      }
      if (reason === 'OTHER' ? !detailText || detailText.length > 200 : body.detail !== undefined) {
        return invalid([{ field: 'detail', message: '기타 사유는 1~200자로 입력해 주세요' }]);
      }
      const id = Number(body.targetId);
      let owner: number | null;
      if (type === 'POST') {
        const p = community.posts.get(id);
        if (!p || p.status === 'DELETED' || !canSee(p, request)) return notFound();
        owner = p.userId;
      } else {
        if (!commentPreview(id)) return error(404, 'NOT_FOUND', '댓글을 찾을 수 없어요');
        owner = commentAuthorOf(id);
      }
      if (owner === v.userId) return error(403, 'REPORT_OWN_CONTENT', '내 글이나 댓글은 신고할 수 없어요');
      if (!addReport(type, id, v.userId!, reason, reason === 'OTHER' ? detailText : undefined)) {
        return error(409, 'REPORT_DUPLICATED', '이미 신고했어요');
      }
      return HttpResponse.json({ targetType: type, targetId: id }, { status: 201 });
    }),

    http.get('*/api/admin/reports', ({ request }) => {
      const v = viewer(request);
      if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      if (!v.admin) return error(403, 'FORBIDDEN', '관리자만 접근할 수 있어요');
      const url = new URL(request.url);
      const state = url.searchParams.get('state');
      if (state && state !== 'PENDING' && state !== 'HIDDEN') return error(400, 'VALIDATION_FAILED', '상태 값이 올바르지 않아요');
      const list = [...community.reports.values()]
        .filter((r) => r.state !== 'CLEARED' && (!state || r.state === state))
        .sort((a, b) => b.lastReportedAt.localeCompare(a.lastReportedAt))
        .map(toReportTarget)
        .filter((r): r is ReportTarget => r !== null);
      return HttpResponse.json(cursorPage(list, url));
    }),

    http.put('*/api/admin/reports/:type/:id', async ({ request, params }) => {
      const v = viewer(request);
      if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      if (!v.admin) return error(403, 'FORBIDDEN', '관리자만 접근할 수 있어요');
      const type = params.type as ReportTargetType;
      const id = Number(params.id);
      const r = community.reports.get(reportKey(type, id));
      if (!r || !previewOf(type, id)) return error(404, 'NOT_FOUND', '신고를 찾을 수 없어요');
      const { action } = (await request.json()) as { action: 'HIDE' | 'CLEAR' };
      if (action === 'HIDE') {
        hideTarget(type, id, 'ADMIN');
        r.state = 'HIDDEN';
      } else if (action === 'CLEAR') {
        showTarget(type, id);
        r.state = 'CLEARED';
      } else {
        return error(400, 'VALIDATION_FAILED', '처리 값이 올바르지 않아요');
      }
      return HttpResponse.json(toReportTarget(r));
    }),

    ...([true, false] as const).map((hidden) =>
      (hidden ? http.put : http.delete)('*/api/admin/community/posts/:id/hidden', ({ request, params }) => {
        const v = viewer(request);
        if (!v.user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
        if (!v.admin) return error(403, 'FORBIDDEN', '관리자만 접근할 수 있어요');
        const p = community.posts.get(Number(params.id));
        if (!p || p.status === 'DELETED') return notFound();
        const r = community.reports.get(reportKey('POST', p.id));
        if (hidden) {
          if (p.status === 'VISIBLE') Object.assign(p, { status: 'HIDDEN', hiddenReason: 'ADMIN' });
          if (r) r.state = 'HIDDEN';
        } else {
          Object.assign(p, { status: 'VISIBLE', hiddenReason: null });
          if (r) r.state = 'CLEARED';
        }
        return HttpResponse.json(detail(p, request));
      }),
    ),
  ];
}
