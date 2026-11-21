export interface PostRow {
  id: number | string;
  title: string;
  summary: string | null;
  url: string;
  thumbnail_url: string | null;
  published_at: Date;
  view_count: number;
  like_count: number;
  comment_count: number;
  source_id: number | string;
  source_name: string;
  source_logo_url: string | null;
  source_type: 'COMPANY' | 'PERSONAL';
}

export interface TagRow {
  post_id: number | string;
  id: number | string;
  name: string;
}

export interface PostSummary {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
  source: { id: number; name: string; logoUrl: string | null; type: 'COMPANY' | 'PERSONAL' };
  tags: { id: number; name: string }[];
  isPopular: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isBookmarked?: boolean;
  isRead?: boolean;
}

export interface UserFlags {
  bookmarked: Set<number>;
  read: Set<number>;
  liked: Set<number>;
}

export function assembleCards(
  orderedIds: number[],
  posts: PostRow[],
  tags: TagRow[],
  flags?: UserFlags,
  popular: ReadonlySet<number> = new Set(),
): (PostSummary & { viewCount: number })[] {
  const byId = new Map(posts.map((p) => [Number(p.id), p]));
  const tagsByPost = new Map<number, { id: number; name: string }[]>();
  for (const tag of tags) {
    const postId = Number(tag.post_id);
    const list = tagsByPost.get(postId) ?? [];
    list.push({ id: Number(tag.id), name: tag.name });
    tagsByPost.set(postId, list);
  }
  const cards: (PostSummary & { viewCount: number })[] = [];
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (!row) continue;
    const card: PostSummary & { viewCount: number } = {
      id,
      title: row.title,
      summary: row.summary,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      publishedAt: row.published_at,
      source: {
        id: Number(row.source_id),
        name: row.source_name,
        logoUrl: row.source_logo_url,
        type: row.source_type,
      },
      tags: tagsByPost.get(id) ?? [],
      isPopular: popular.has(id),
      likeCount: Number(row.like_count),
      commentCount: Number(row.comment_count),
      likedByMe: flags?.liked.has(id) ?? false,
      viewCount: row.view_count,
    };
    if (flags) {
      card.isBookmarked = flags.bookmarked.has(id);
      card.isRead = flags.read.has(id);
    }
    cards.push(card);
  }
  return cards;
}

export function withoutViewCount<T extends { viewCount: number }>(card: T): Omit<T, 'viewCount'> {
  const { viewCount: _omit, ...rest } = card;
  return rest;
}
