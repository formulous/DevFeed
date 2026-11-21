import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Comment, CursorPage } from '@/api/types';

export const commentsKey = (postId: number) => ['comments', postId] as const;

type Data = InfiniteData<CursorPage<Comment>>;

function mapPages(client: QueryClient, postId: number, fn: (items: Comment[]) => Comment[]) {
  client.setQueryData<Data>(commentsKey(postId), (data) =>
    data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: fn(p.items) })) } : data,
  );
}

function mapAll(items: Comment[], fn: (c: Comment) => Comment): Comment[] {
  return items.map((c) => fn({ ...c, replies: c.replies?.map(fn) }));
}

export function addComment(client: QueryClient, postId: number, comment: Comment) {
  if (comment.parentId === null) {
    client.setQueryData<Data>(commentsKey(postId), (data) => {
      if (!data) return data;
      const pages = [...data.pages];
      const last = pages[pages.length - 1];
      pages[pages.length - 1] = { ...last, items: [...last.items, comment] };
      return { ...data, pages };
    });
    return;
  }
  mapPages(client, postId, (items) =>
    items.map((c) =>
      c.id === comment.parentId ? { ...c, replies: [...(c.replies ?? []), comment], replyCount: c.replyCount + 1 } : c,
    ),
  );
}

export function replaceComment(client: QueryClient, postId: number, comment: Comment) {
  mapPages(client, postId, (items) =>
    mapAll(items, (c) => (c.id === comment.id ? { ...comment, replies: c.replies, repliesNextCursor: c.repliesNextCursor } : c)),
  );
}

export function markDeleted(client: QueryClient, postId: number, id: number) {
  mapPages(client, postId, (items) =>
    mapAll(items, (c) => (c.id === id ? { ...c, status: 'DELETED', content: null, author: null, mine: false } : c)),
  );
}

export function removeComment(client: QueryClient, postId: number, id: number, parentRemoved: boolean) {
  mapPages(client, postId, (items) =>
    items.flatMap((c) => {
      if (c.id === id) return [];
      if (!c.replies?.some((r) => r.id === id)) return [c];
      if (parentRemoved) return [];
      return [{ ...c, replies: c.replies.filter((r) => r.id !== id), replyCount: Math.max(0, c.replyCount - 1) }];
    }),
  );
}

export function appendReplies(client: QueryClient, postId: number, parentId: number, page: CursorPage<Comment>) {
  mapPages(client, postId, (items) =>
    items.map((c) => {
      if (c.id !== parentId) return c;
      const known = new Set((c.replies ?? []).map((r) => r.id));
      return { ...c, replies: [...(c.replies ?? []), ...page.items.filter((r) => !known.has(r.id))], repliesNextCursor: page.nextCursor };
    }),
  );
}
