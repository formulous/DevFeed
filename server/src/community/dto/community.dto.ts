import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import { toInt } from '../../common/validation/query-transforms';
import type { PopularPeriod } from '../../posts/period';
import type { CommunityPopularSort } from '../community.service';
import type { CommunityCategory } from '../../posts/post-cards';

export const CATEGORIES: CommunityCategory[] = ['QUESTION', 'DISCUSSION', 'SHARE'];
export const REPORT_REASONS = ['SPAM', 'ABUSE', 'PRIVACY', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const chars = (value: string) => [...value].length;

function CodePointLength(min: number, max: number, message: string): PropertyDecorator {
  return ValidateBy({
    name: 'codePointLength',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && chars(value) >= min && chars(value) <= max,
      defaultMessage: () => message,
    },
  });
}

function MarkdownBody(): PropertyDecorator {
  return ValidateBy({
    name: 'markdownBody',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && chars(value.trim()) >= 10 && chars(value) <= 20000,
      defaultMessage: () => '본문은 10~20,000자로 입력해 주세요',
    },
  });
}

function NoControlChars(): PropertyDecorator {
  return ValidateBy({
    name: 'noControlChars',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && !CONTROL.test(value),
      defaultMessage: () => '쓸 수 없는 문자가 들어 있어요',
    },
  });
}

const CATEGORY_MESSAGE = { message: 'QUESTION, DISCUSSION, SHARE 중 하나여야 해요' };
const TITLE_MESSAGE = '제목은 2~100자로 입력해 주세요';

export class CommunityListQuery {
  @IsOptional()
  @IsString({ message: '문자열이어야 해요' })
  @MaxLength(200, { message: '최대 200자까지 입력할 수 있어요' })
  cursor?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 해요' })
  @Min(1, { message: '1 이상이어야 해요' })
  @Max(50, { message: '50 이하여야 해요' })
  size?: number;

  @IsOptional()
  @IsIn(CATEGORIES, CATEGORY_MESSAGE)
  category?: CommunityCategory;
}

export class CommunityPopularQuery {
  @IsIn(['DAY', 'WEEK', 'MONTH'], { message: 'DAY, WEEK, MONTH 중 하나여야 해요' })
  period: PopularPeriod;

  @IsOptional()
  @IsIn(CATEGORIES, CATEGORY_MESSAGE)
  category?: CommunityCategory;

  @IsOptional()
  @IsIn(['SCORE', 'COMMENTS', 'LIKES', 'REACTIONS'], { message: 'SCORE, COMMENTS, LIKES, REACTIONS 중 하나여야 해요' })
  sort?: CommunityPopularSort;

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 해요' })
  @Min(1, { message: '1 이상이어야 해요' })
  @Max(20, { message: '20 이하여야 해요' })
  size?: number;
}

export class CreateCommunityPostDto {
  @IsIn(CATEGORIES, CATEGORY_MESSAGE)
  category: CommunityCategory;

  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @CodePointLength(2, 100, TITLE_MESSAGE)
  @Matches(/^[^\r\n]*$/, { message: '제목에는 줄바꿈을 넣을 수 없어요' })
  @NoControlChars()
  title: string;

  @IsString({ message: '문자열이어야 해요' })
  @MarkdownBody()
  @NoControlChars()
  body: string;

  @IsOptional()
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(5, { message: '태그는 5개까지 고를 수 있어요' })
  @ArrayUnique({ message: '같은 태그를 두 번 고를 수 없어요' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 해요' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 해요' })
  tagIds?: number[];
}

export class UpdateCommunityPostDto {
  @IsOptional()
  @IsIn(CATEGORIES, CATEGORY_MESSAGE)
  category?: CommunityCategory;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @CodePointLength(2, 100, TITLE_MESSAGE)
  @Matches(/^[^\r\n]*$/, { message: '제목에는 줄바꿈을 넣을 수 없어요' })
  @NoControlChars()
  title?: string;

  @IsOptional()
  @IsString({ message: '문자열이어야 해요' })
  @MarkdownBody()
  @NoControlChars()
  body?: string;

  @IsOptional()
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(5, { message: '태그는 5개까지 고를 수 있어요' })
  @ArrayUnique({ message: '같은 태그를 두 번 고를 수 없어요' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 해요' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 해요' })
  tagIds?: number[];
}

export class AcceptCommentDto {
  @IsInt({ message: '1 이상 정수여야 해요' })
  @Min(1, { message: '1 이상 정수여야 해요' })
  commentId: number;
}

export class CreateReportDto {
  @IsIn(['POST', 'COMMENT'], { message: 'POST 또는 COMMENT여야 해요' })
  targetType: 'POST' | 'COMMENT';

  @IsInt({ message: '1 이상 정수여야 해요' })
  @Min(1, { message: '1 이상 정수여야 해요' })
  targetId: number;

  @IsIn(REPORT_REASONS, { message: 'SPAM, ABUSE, PRIVACY, OTHER 중 하나여야 해요' })
  reason: ReportReason;

  @ValidateIf((dto: CreateReportDto) => dto.reason === 'OTHER' || dto.detail !== undefined)
  @Transform(trim)
  @IsString({ message: '기타 사유를 입력해 주세요' })
  @CodePointLength(1, 200, '기타 사유는 1~200자로 입력해 주세요')
  @ValidateBy({
    name: 'detailOnlyForOther',
    validator: {
      validate: (_value: unknown, args) => (args?.object as CreateReportDto).reason === 'OTHER',
      defaultMessage: () => '기타 사유에만 내용을 넣을 수 있어요',
    },
  })
  detail?: string;
}

export class AdminReportsQuery {
  @IsOptional()
  @IsString({ message: '문자열이어야 해요' })
  @MaxLength(200, { message: '최대 200자까지 입력할 수 있어요' })
  cursor?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 해요' })
  @Min(1, { message: '1 이상이어야 해요' })
  @Max(50, { message: '50 이하여야 해요' })
  size?: number;

  @IsOptional()
  @IsIn(['PENDING', 'HIDDEN'], { message: 'PENDING 또는 HIDDEN이어야 해요' })
  state?: 'PENDING' | 'HIDDEN';
}

export class ResolveReportDto {
  @IsIn(['HIDE', 'CLEAR'], { message: 'HIDE 또는 CLEAR여야 해요' })
  action: 'HIDE' | 'CLEAR';
}
