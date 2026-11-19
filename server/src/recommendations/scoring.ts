export type SignalKind = 'INTEREST' | 'BOOKMARK' | 'READ';
export type ReasonType = 'INTEREST_TAG' | 'BOOKMARK' | 'READ_HISTORY' | 'POPULAR';
export type Algorithm = 'TAG_V1' | 'COLD_POPULAR';

export const WEIGHTS: Record<SignalKind, number> = { INTEREST: 3, BOOKMARK: 2, READ: 1 };
export const HALF_LIFE_DAYS = 7;
export const SIGNAL_WINDOW_DAYS = 30;
export const CANDIDATE_WINDOW_DAYS = 14;
export const SCORE_MIX = { tag: 0.7, popularity: 0.2, recency: 0.1 };
export const MAX_RANKED = 200;
export const MIN_RESULTS = 20;
export const MAX_SAME_SOURCE_RUN = 2;
export const TOP_PREFERRED_TAGS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Signal {
  kind: SignalKind;
  tagId: number;
  at?: Date;
}

export interface TagPreference {
  tagId: number;
  score: number;
  byKind: Record<SignalKind, number>;
}

export function decay(at: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - at.getTime()) / DAY_MS);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

export function computePreferences(signals: Signal[], now: Date): Map<number, TagPreference> {
  const raw = new Map<number, Record<SignalKind, number>>();
  for (const signal of signals) {
    const weight = WEIGHTS[signal.kind] * (signal.kind === 'INTEREST' || !signal.at ? 1 : decay(signal.at, now));
    const entry = raw.get(signal.tagId) ?? { INTEREST: 0, BOOKMARK: 0, READ: 0 };
    if (signal.kind === 'INTEREST') entry.INTEREST = Math.max(entry.INTEREST, weight);
    else entry[signal.kind] += weight;
    raw.set(signal.tagId, entry);
  }
  let max = 0;
  for (const entry of raw.values()) max = Math.max(max, entry.INTEREST + entry.BOOKMARK + entry.READ);
  const prefs = new Map<number, TagPreference>();
  if (max <= 0) return prefs;
  for (const [tagId, entry] of raw) {
    const total = entry.INTEREST + entry.BOOKMARK + entry.READ;
    prefs.set(tagId, { tagId, score: total / max, byKind: entry });
  }
  return prefs;
}

export function topPreferredTags(prefs: Map<number, TagPreference>, limit = TOP_PREFERRED_TAGS): number[] {
  return [...prefs.values()]
    .sort((a, b) => b.score - a.score || a.tagId - b.tagId)
    .slice(0, limit)
    .map((p) => p.tagId);
}

export interface Candidate {
  postId: number;
  sourceId: number;
  viewCount: number;
  publishedAt: Date;
  tagIds: number[];
}

export interface Reason {
  type: ReasonType;
  tagName?: string;
}

export interface RankedItem {
  postId: number;
  sourceId: number;
  algorithm: Algorithm;
  score: number;
  reasonTags: { tagId: number; type: ReasonType }[];
}

function dominantReason(pref: TagPreference): ReasonType {
  const { INTEREST, BOOKMARK, READ } = pref.byKind;
  if (INTEREST >= BOOKMARK && INTEREST >= READ) return 'INTEREST_TAG';
  return BOOKMARK >= READ ? 'BOOKMARK' : 'READ_HISTORY';
}

export function scoreCandidates(candidates: Candidate[], prefs: Map<number, TagPreference>, now: Date): RankedItem[] {
  const maxViews = candidates.reduce((m, c) => Math.max(m, c.viewCount), 0);
  const windowMs = CANDIDATE_WINDOW_DAYS * DAY_MS;
  const items: (RankedItem & { publishedAt: number })[] = [];
  for (const c of candidates) {
    const matched = c.tagIds
      .map((tagId) => prefs.get(tagId))
      .filter((p): p is TagPreference => !!p)
      .sort((a, b) => b.score - a.score || a.tagId - b.tagId);
    if (!matched.length) continue;
    const tag = Math.min(1, matched.reduce((sum, p) => sum + p.score, 0));
    const popularity = maxViews > 0 ? Math.log1p(c.viewCount) / Math.log1p(maxViews) : 0;
    const age = now.getTime() - c.publishedAt.getTime();
    const recency = Math.min(1, Math.max(0, 1 - age / windowMs));
    items.push({
      postId: c.postId,
      sourceId: c.sourceId,
      algorithm: 'TAG_V1',
      score: SCORE_MIX.tag * tag + SCORE_MIX.popularity * popularity + SCORE_MIX.recency * recency,
      reasonTags: matched.slice(0, 2).map((p) => ({ tagId: p.tagId, type: dominantReason(p) })),
      publishedAt: c.publishedAt.getTime(),
    });
  }
  items.sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt || b.postId - a.postId);
  return items.slice(0, MAX_RANKED).map(({ publishedAt: _p, ...item }) => item);
}

export function coldItems(posts: { postId: number; sourceId: number }[]): RankedItem[] {
  return posts.map((p) => ({ postId: p.postId, sourceId: p.sourceId, algorithm: 'COLD_POPULAR', score: 0, reasonTags: [] }));
}

export function fillToMinimum(ranked: RankedItem[], cold: RankedItem[], minimum = MIN_RESULTS): RankedItem[] {
  if (ranked.length >= minimum) return ranked;
  const used = new Set(ranked.map((r) => r.postId));
  const filled = [...ranked];
  for (const item of cold) {
    if (filled.length >= minimum) break;
    if (used.has(item.postId)) continue;
    used.add(item.postId);
    filled.push(item);
  }
  return filled;
}

export function diversify<T extends { sourceId: number }>(items: T[], maxRun = MAX_SAME_SOURCE_RUN): T[] {
  const pending = [...items];
  const result: T[] = [];
  while (pending.length) {
    const runSource = result.length >= maxRun && result.slice(-maxRun).every((r) => r.sourceId === result[result.length - 1].sourceId)
      ? result[result.length - 1].sourceId
      : null;
    const index = runSource === null ? 0 : pending.findIndex((p) => p.sourceId !== runSource);
    result.push(pending.splice(index === -1 ? 0 : index, 1)[0]);
  }
  return result;
}

export function toReasons(item: RankedItem, tagNames: Map<number, string>): Reason[] {
  if (item.algorithm === 'COLD_POPULAR' || !item.reasonTags.length) return [{ type: 'POPULAR' }];
  return item.reasonTags.map((r) => ({ type: r.type, tagName: tagNames.get(r.tagId) }));
}

export function reasonLabel(reasons: Reason[]): string {
  const first = reasons[0];
  return (first.tagName ? `${first.type}:${first.tagName}` : first.type).slice(0, 200);
}
