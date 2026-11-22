import type { CommunityCategory, ReportReason, ReportState, ReportTargetType, TagRef } from '@/api/types';

export interface MockCommunityPost {
  id: number;
  userId: number | null;
  nickname: string;
  category: CommunityCategory;
  title: string;
  body: string;
  tags: TagRef[];
  status: 'VISIBLE' | 'HIDDEN' | 'DELETED';
  hiddenReason: 'ADMIN' | 'REPORTS' | null;
  acceptedCommentId: number | null;
  createdAt: string;
  editedAt: string | null;
  viewCount: number;
  scored: boolean;
}

export interface MockReportTarget {
  targetType: ReportTargetType;
  targetId: number;
  reporters: Set<number>;
  reasons: Record<ReportReason, number>;
  details: string[];
  state: ReportState;
  lastReportedAt: string;
}

export const COMMUNITY_SEED_START = 5000;
export const SOLVED_POST_ID = 5001;
export const XSS_POST_ID = 5004;
export const MY_POST_ID = 5007;

export const community = {
  posts: new Map<number, MockCommunityPost>(),
  reports: new Map<string, MockReportTarget>(),
  writes: [] as { userId: number; at: number }[],
  seq: 6000,
};

export const reportKey = (type: ReportTargetType, id: number) => `${type}:${id}`;

export const isCommunityPost = (id: number) => community.posts.has(id);

export function isClosedPost(id: number) {
  const p = community.posts.get(id);
  return !!p && p.status !== 'VISIBLE';
}

export function isAcceptedComment(commentId: number) {
  for (const p of community.posts.values()) if (p.acceptedCommentId === commentId) return true;
  return false;
}

export function releaseAccepted(commentId: number) {
  for (const p of community.posts.values()) if (p.acceptedCommentId === commentId) p.acceptedCommentId = null;
}

export function reportedBy(type: ReportTargetType, id: number, userId: number | null) {
  if (userId === null) return false;
  return community.reports.get(reportKey(type, id))?.reporters.has(userId) ?? false;
}

export function communityPublishedAt(id: number) {
  return community.posts.get(id)?.createdAt ?? null;
}
