import { http, HttpResponse } from 'msw';
import type { Comment, CommentStatus, Me } from '@/api/types';
import { mockNewsPosts, mockPosts } from './fixtures';

interface MockComment {
  id: number;
  postId: number;
  parentId: number | null;
  authorId: number | null;
  nickname: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  editedAt: string | null;
}

interface Ctx {
  isMember: (request: Request) => boolean;
  me: () => Me | null;
  error: (status: number, code: string, message: string) => Response;
}

const RATE_PER_MINUTE = 5;
const REPLY_PREVIEW = 3;
export const BUSY_POST_ID = mockPosts[0].id;

const store = {
  likes: new Set<number>(),
  comments: new Map<number, MockComment[]>(),
  seq: 10_000,
  recent: [] as number[],
};

const NAMES = ['백엔드곰', '리액트러', '데이터쟁이', '인프라맨', '코틀린팬'];

function at(postId: number, minutesAfter: number) {
  const post = mockPosts.find((p) => p.id === postId) ?? mockNewsPosts.find((p) => p.id === postId);
  return new Date(Date.parse(post?.publishedAt ?? '2026-01-01T00:00:00Z') + minutesAfter * 60_000).toISOString();
}

function seed(postId: number): MockComment[] {
  const list: MockComment[] = [];
  const add = (parentId: number | null, i: number, extra: Partial<MockComment> = {}) => {
    const c: MockComment = {
      id: postId * 1000 + list.length + 1,
      postId,
      parentId,
      authorId: 900 + (i % NAMES.length),
      nickname: NAMES[i % NAMES.length],
      content: `댓글 ${list.length + 1}: 잘 읽었어요. 정리 감사해요`,
      status: 'VISIBLE',
      createdAt: at(postId, (list.length + 1) * 7),
      editedAt: null,
      ...extra,
    };
    list.push(c);
    return c;
  };
  if (postId === BUSY_POST_ID) {
    const first = add(null, 0, { content: '리밸런싱 시간 줄이는 설정 참고됐어요\n특히 session.timeout 부분이요' });
    for (let i = 0; i < 5; i++) add(first.id, i + 1, { content: `답글 ${i + 1}: 저도 같은 문제 겪었어요` });
    const gone = add(null, 2, { status: 'DELETED', content: '', authorId: null });
    add(gone.id, 3, { content: '삭제된 댓글에 남은 답글이에요' });
    add(null, 4, { status: 'HIDDEN', content: '광고성 댓글' });
    add(null, 1, { content: '<script>alert(1)</script> 이건 글자 그대로 보여야 해요' });
    for (let i = 0; i < 20; i++) add(null, i);
  } else if (postId % 3 === 0) {
    const c = add(null, postId);
    add(c.id, postId + 1);
    add(null, postId + 2);
  }
  return list;
}

function commentsOf(postId: number) {
  let list = store.comments.get(postId);
  if (!list) {
    list = seed(postId);
    store.comments.set(postId, list);
  }
  return list;
}

const baseLikes = (postId: number) => (postId === BUSY_POST_ID ? 1234 : postId % 5 === 0 ? 0 : (postId * 13) % 40);

export function likeCount(postId: number) {
  return baseLikes(postId) + (store.likes.has(postId) ? 1 : 0);
}

export function commentCount(postId: number) {
  return commentsOf(postId).filter((c) => c.status === 'VISIBLE').length;
}

export function reactionFields(postId: number, member: boolean) {
  return { likeCount: likeCount(postId), commentCount: commentCount(postId), likedByMe: member && store.likes.has(postId) };
}

export function resetReactions() {
  store.likes.clear();
  store.comments.clear();
  store.recent = [];
}

export function withdrawReactions(userId: number) {
  store.likes.clear();
  for (const [postId, list] of store.comments) {
    for (const c of list.filter((x) => x.authorId === userId)) removeOrMark(postId, c);
  }
}

const findComment = (id: number) => {
  for (const [postId, list] of store.comments) {
    const c = list.find((x) => x.id === id);
    if (c) return { postId, list, c };
  }
  return null;
};

const visibleReplies = (list: MockComment[], id: number) => list.filter((r) => r.parentId === id && r.status === 'VISIBLE');
const shownReplies = (list: MockComment[], id: number) => list.filter((r) => r.parentId === id);

function removeOrMark(postId: number, c: MockComment) {
  const list = commentsOf(postId);
  if (c.parentId === null && visibleReplies(list, c.id).length > 0) {
    Object.assign(c, { status: 'DELETED', content: '', authorId: null });
    return { removed: false, parentRemoved: false };
  }
  list.splice(list.indexOf(c), 1);
  if (c.parentId !== null) {
    const parent = list.find((p) => p.id === c.parentId);
    if (parent?.status === 'DELETED' && shownReplies(list, parent.id).length === 0) {
      list.splice(list.indexOf(parent), 1);
      return { removed: true, parentRemoved: true };
    }
  }
  return { removed: true, parentRemoved: false };
}

function cursorSlice<T>(list: T[], url: URL, start = 0) {
  const size = Math.min(Number(url.searchParams.get('size') ?? 20), 50);
  const cursor = url.searchParams.get('cursor');
  const offset = cursor ? Number(atob(cursor)) : start;
  const next = offset + size;
  return { items: list.slice(offset, next), nextCursor: next < list.length ? btoa(String(next)) : null };
}

export function reactionHandlers({ isMember, me, error }: Ctx) {
  const view = (request: Request) => {
    const member = isMember(request) ? me() : null;
    return { userId: member?.id ?? null, admin: member?.role === 'ADMIN' };
  };

  const toApi = (c: MockComment, v: ReturnType<typeof view>, list: MockComment[], withReplies: boolean): Comment => {
    const replies = c.parentId === null ? shownReplies(list, c.id) : [];
    const content = c.status === 'VISIBLE' || (c.status === 'HIDDEN' && v.admin) ? c.content : null;
    const base: Comment = {
      id: c.id,
      parentId: c.parentId,
      status: c.status,
      content,
      author: c.status === 'DELETED' || c.authorId === null ? null : { id: c.authorId, nickname: c.nickname },
      createdAt: c.createdAt,
      editedAt: c.editedAt,
      mine: c.status !== 'DELETED' && c.authorId !== null && c.authorId === v.userId,
      replyCount: visibleReplies(list, c.id).length,
    };
    if (!withReplies || c.parentId !== null) return base;
    return {
      ...base,
      replies: replies.slice(0, REPLY_PREVIEW).map((r) => toApi(r, v, list, false)),
      repliesNextCursor: replies.length > REPLY_PREVIEW ? btoa(String(REPLY_PREVIEW)) : null,
    };
  };

  const validate = (content: unknown) => {
    const text = typeof content === 'string' ? content.trim() : '';
    if (text.length < 1 || text.length > 1000) return null;
    return text;
  };

  const invalid = () =>
    HttpResponse.json(
      { code: 'VALIDATION_FAILED', message: '요청 값이 올바르지 않아요', fieldErrors: [{ field: 'content', message: '1~1,000자로 입력해 주세요' }] },
      { status: 400 },
    );

  const likeRoute = (liked: boolean) => ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
    if (!isMember(request)) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
    const id = Number(params.id);
    if (liked) store.likes.add(id);
    else store.likes.delete(id);
    return HttpResponse.json({ liked, likeCount: likeCount(id) });
  };

  return [
    http.put('*/api/posts/:id/like', likeRoute(true)),
    http.delete('*/api/posts/:id/like', likeRoute(false)),

    http.get('*/api/posts/:id/comments', ({ request, params }) => {
      const postId = Number(params.id);
      const list = commentsOf(postId);
      const v = view(request);
      const page = cursorSlice(list.filter((c) => c.parentId === null), new URL(request.url));
      return HttpResponse.json({ ...page, items: page.items.map((c) => toApi(c, v, list, true)) });
    }),

    http.get('*/api/comments/:id/replies', ({ request, params }) => {
      const found = findComment(Number(params.id));
      if (!found) return error(404, 'NOT_FOUND', '대상을 찾을 수 없어요');
      const v = view(request);
      const page = cursorSlice(shownReplies(found.list, found.c.id), new URL(request.url));
      return HttpResponse.json({ ...page, items: page.items.map((c) => toApi(c, v, found.list, false)) });
    }),

    http.post('*/api/posts/:id/comments', async ({ request, params }) => {
      const user = isMember(request) ? me() : null;
      if (!user) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const body = (await request.json()) as { content?: unknown; parentId?: number };
      const content = validate(body.content);
      if (!content) return invalid();
      const now = Date.now();
      store.recent = store.recent.filter((t) => now - t < 60_000);
      if (store.recent.length >= RATE_PER_MINUTE) {
        return HttpResponse.json(
          { code: 'COMMENT_RATE_LIMITED', message: '잠시 후 다시 남겨 주세요', retryAfterSec: 60 },
          { status: 429 },
        );
      }
      const postId = Number(params.id);
      const list = commentsOf(postId);
      let parentId: number | null = null;
      if (body.parentId) {
        const parent = list.find((c) => c.id === body.parentId);
        if (!parent) return error(404, 'NOT_FOUND', '대상을 찾을 수 없어요');
        parentId = parent.parentId ?? parent.id;
      }
      store.recent.push(now);
      const c: MockComment = {
        id: ++store.seq,
        postId,
        parentId,
        authorId: user.id,
        nickname: user.nickname,
        content,
        status: 'VISIBLE',
        createdAt: new Date(now).toISOString(),
        editedAt: null,
      };
      list.push(c);
      return HttpResponse.json({ comment: toApi(c, view(request), list, true), commentCount: commentCount(postId) }, { status: 201 });
    }),

    http.patch('*/api/comments/:id', async ({ request, params }) => {
      const v = view(request);
      if (v.userId === null) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const found = findComment(Number(params.id));
      if (!found || found.c.status !== 'VISIBLE') return error(404, 'NOT_FOUND', '대상을 찾을 수 없어요');
      if (found.c.authorId !== v.userId) return error(403, 'FORBIDDEN', '권한이 없어요');
      const content = validate(((await request.json()) as { content?: unknown }).content);
      if (!content) return invalid();
      Object.assign(found.c, { content, editedAt: new Date().toISOString() });
      return HttpResponse.json(toApi(found.c, v, found.list, false));
    }),

    http.delete('*/api/comments/:id', ({ request, params }) => {
      const v = view(request);
      if (v.userId === null) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
      const found = findComment(Number(params.id));
      if (!found || found.c.status === 'DELETED') return error(404, 'NOT_FOUND', '대상을 찾을 수 없어요');
      if (found.c.authorId !== v.userId) return error(403, 'FORBIDDEN', '권한이 없어요');
      const result = removeOrMark(found.postId, found.c);
      return HttpResponse.json({ ...result, commentCount: commentCount(found.postId) });
    }),

    ...([true, false] as const).map((hidden) =>
      (hidden ? http.put : http.delete)('*/api/admin/comments/:id/hidden', ({ request, params }) => {
        const v = view(request);
        if (v.userId === null) return error(401, 'UNAUTHENTICATED', '로그인이 필요해요');
        if (!v.admin) return error(403, 'FORBIDDEN', '관리자만 접근할 수 있어요');
        const found = findComment(Number(params.id));
        if (!found || found.c.status === 'DELETED') return error(404, 'NOT_FOUND', '대상을 찾을 수 없어요');
        found.c.status = hidden ? 'HIDDEN' : 'VISIBLE';
        return HttpResponse.json({ comment: toApi(found.c, v, found.list, false), commentCount: commentCount(found.postId) });
      }),
    ),
  ];
}
