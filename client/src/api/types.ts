export type Role = 'USER' | 'ADMIN';
export type SourceType = 'COMPANY' | 'PERSONAL';

export interface SourceRef {
  id: number;
  name: string;
  logoUrl: string | null;
  type: SourceType;
}

export interface TagRef {
  id: number;
  name: string;
}

export interface PostSummary {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  source: SourceRef;
  tags: TagRef[];
  isBookmarked?: boolean;
  isRead?: boolean;
}

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
