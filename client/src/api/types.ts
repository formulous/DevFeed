export type Role = 'USER' | 'ADMIN';
export type SourceType = 'COMPANY' | 'PERSONAL';
export type SourceKind = 'BLOG' | 'SECURITY_NEWS';
export type NewsRegion = 'DOMESTIC' | 'OVERSEAS';

export interface SecurityNewsSource {
  id: number;
  name: string;
  logoUrl: string | null;
  region: NewsRegion;
}

export interface SourceRef {
  id: number;
  name: string;
  logoUrl: string | null;
  type: SourceType;
}

export interface SourceListItem extends SourceRef {
  postCount?: number;
  recentPostCount?: number;
}

export interface TagRef {
  id: number;
  name: string;
}

export type PostKind = SourceKind | 'COMMUNITY';

export type CommunityCategory = 'QUESTION' | 'DISCUSSION' | 'SHARE';

export interface CommunityInfo {
  category: CommunityCategory;
  author: CommentAuthor | null;
  editedAt: string | null;
  solved: boolean;
  viewCount: number;
}

export interface PostSummary {
  id: number;
  kind?: PostKind;
  community?: CommunityInfo;
  title: string;
  summary: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  source: SourceRef;
  tags: TagRef[];
  isBookmarked?: boolean;
  isRead?: boolean;
  isPopular?: boolean;
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
}

export type CommentStatus = 'VISIBLE' | 'DELETED' | 'HIDDEN';

export interface Comment {
  id: number;
  postId: number;
  parentId: number | null;
  status: CommentStatus;
  content: string | null;
  author: CommentAuthor | null;
  createdAt: string;
  editedAt: string | null;
  mine: boolean;
  reportedByMe?: boolean;
  replyCount: number;
  replies?: Comment[];
  repliesNextCursor?: string | null;
}

export interface LikeResult {
  liked: boolean;
  likeCount: number;
}

export interface CommentWithCount {
  comment: Comment;
  commentCount: number;
}

export type CommentCreated = CommentWithCount;

export interface CommentRemoved {
  commentCount: number;
  removed: boolean;
  parentRemoved: boolean;
}

export interface PopularPost extends PostSummary {
  viewCount: number;
}

export type PopularPeriod = 'DAY' | 'WEEK' | 'MONTH';

export type TechRankSort = 'VIEWS' | 'COMMENTS';

export type CommunityRankSort = 'SCORE' | 'COMMENTS' | 'LIKES';

export interface TagItem extends TagRef {
  slug: string;
  category: string | null;
  postCount: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PagedList<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: FieldError[];
  retryAfterSec?: number;
  reason?: string;
  availableAt?: string;
}

export interface Me {
  id: number;
  email: string;
  nickname: string;
  role: Role;
  hasInterestTags: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: Me;
}

export type SourceStatus = 'ACTIVE' | 'ERROR' | 'INACTIVE';

export interface AdminStats {
  todayNewPostCount: number;
  failingSourceCount: number;
  activeSourceCount: number;
}

export interface AdminSourceListItem extends SourceRef {
  kind: SourceKind;
  region: NewsRegion | null;
  status: SourceStatus;
  lastSuccessAt: string | null;
  newPostCount7d: number;
  consecutiveFailures: number;
}

export interface AdminSource extends AdminSourceListItem {
  siteUrl: string;
  feedUrl: string;
  crawlIntervalMin: number;
  nextCrawlAt: string;
  lastCrawledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceInput {
  name: string;
  siteUrl: string;
  feedUrl: string;
  type: SourceType;
  kind?: SourceKind;
  region?: NewsRegion | null;
  logoUrl: string | null;
  crawlIntervalMin: number;
}

export type UpdateSourceInput = Partial<Omit<SourceInput, 'kind'>> & { status?: 'ACTIVE' | 'INACTIVE' };

export interface FeedValidationResult {
  valid: boolean;
  format?: 'RSS' | 'ATOM';
  feedTitle?: string;
  itemCount?: number;
  sampleTitles?: string[];
  duplicated?: boolean;
  reason?: string;
}

export type CrawlResult = 'RUNNING' | 'SUCCESS' | 'NOT_MODIFIED' | 'FAILURE';

export interface CrawlRun {
  id: number;
  triggerType: 'SCHEDULED' | 'MANUAL';
  result: CrawlResult;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  attemptCount: number;
  httpStatus: number | null;
  fetchedCount: number;
  newPostCount: number;
  updatedPostCount: number;
  errorMessage: string | null;
}

export interface AdminTag {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  synonyms: string[];
  postCount: number;
}

export interface TagInput {
  name: string;
  slug: string;
  category: string | null;
  synonyms: string[];
}

export interface Job {
  id: string;
  type: 'RETAG';
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  processed: number;
  total: number;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface BookmarkItem extends PostSummary {
  bookmarkedAt: string;
}

export interface BookmarkPage extends CursorPage<BookmarkItem> {
  total: number;
}

export interface HistoryItem extends PostSummary {
  readAt: string;
}

export interface SignupInput {
  email: string;
  password: string;
  nickname: string;
}

export type ReasonType = 'INTEREST_TAG' | 'READ_HISTORY' | 'BOOKMARK' | 'POPULAR';

export interface Reason {
  type: ReasonType;
  tagName?: string;
}

export interface RecommendedPost extends PostSummary {
  reasons: Reason[];
}

export interface RecommendationPage extends CursorPage<RecommendedPost> {
  recommendationId: string;
  fallback: boolean;
}

export interface Passkey {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface GradeRef {
  level: number;
  name: string;
}

export interface CommentAuthor {
  id: number;
  nickname: string;
  grade: GradeRef;
}

export interface ProfileGrade extends GradeRef {
  minScore: number;
  nextMinScore: number | null;
}

export interface Profile {
  nickname: string;
  score: number;
  grade: ProfileGrade;
  stats: { posts?: number; likes: number; comments: number; reads: number; bookmarks: number };
}

export type CommunityPostStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';

export interface CommunityPost extends PostSummary {
  kind: 'COMMUNITY';
  community: CommunityInfo;
  body: string | null;
  status: CommunityPostStatus;
  acceptedCommentId: number | null;
  mine: boolean;
  reportedByMe: boolean;
}

export interface CommunityPostInput {
  category: CommunityCategory;
  title: string;
  body: string;
  tagIds: number[];
}

export type PostWriteReason = 'NEW_ACCOUNT' | 'DAILY_LIMIT' | 'COOLDOWN';

export interface PostWriteStatus {
  allowed: boolean;
  reason: PostWriteReason | null;
  availableAt: string | null;
  retryAfterSec: number | null;
  remainingToday: number | null;
}

export interface AcceptedCommentState {
  acceptedCommentId: number | null;
  solved: boolean;
}

export type ReportTargetType = 'POST' | 'COMMENT';
export type ReportReason = 'SPAM' | 'ABUSE' | 'PRIVACY' | 'OTHER';
export type ReportState = 'PENDING' | 'HIDDEN' | 'CLEARED';

export interface ReportInput {
  targetType: ReportTargetType;
  targetId: number;
  reason: ReportReason;
  detail?: string;
}

export interface ReportTarget {
  targetType: ReportTargetType;
  targetId: number;
  postId: number;
  state: ReportState;
  reportCount: number;
  reasons: Record<ReportReason, number>;
  details?: string[];
  lastReportedAt: string;
  preview: {
    title: string | null;
    text: string;
    author: { id: number; nickname: string } | null;
    status: 'VISIBLE' | 'HIDDEN';
    hiddenReason: 'ADMIN' | 'REPORTS' | null;
  };
}
