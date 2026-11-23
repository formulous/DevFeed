export const REACTION_SORT = 'REACTIONS';

type Reacted = { likeCount?: number; commentCount?: number; publishedAt: string; id: number };

export const reactionScore = (p: Reacted) => (p.likeCount ?? 0) + (p.commentCount ?? 0);

export function rankByReactions<T extends Reacted>(items: T[]) {
  return items
    .filter((p) => reactionScore(p) >= 1)
    .sort(
      (a, b) =>
        reactionScore(b) - reactionScore(a) ||
        (b.commentCount ?? 0) - (a.commentCount ?? 0) ||
        b.publishedAt.localeCompare(a.publishedAt) ||
        b.id - a.id,
    );
}

export function parseSize(url: URL): number | null {
  const raw = url.searchParams.get('size');
  if (raw === null) return 20;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}
