import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { toIdList, toInt } from '../../common/validation/query-transforms';
import type { NewsRegion } from '../../entities/source.entity';
import { FIELDS, type Field } from '../fields';
import type { PopularPeriod } from '../period';

export class FeedQuery {
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
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(10, { message: '최대 10개까지 가능해요' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 해요' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 해요' })
  tagIds?: number[];

  @IsOptional()
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(20, { message: '최대 20개까지 가능해요' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 해요' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 해요' })
  sourceIds?: number[];

  @IsOptional()
  @IsIn(['COMPANY', 'PERSONAL'], { message: 'COMPANY 또는 PERSONAL이어야 해요' })
  sourceType?: 'COMPANY' | 'PERSONAL';

  @IsOptional()
  @IsIn(FIELDS, { message: `${FIELDS.join(', ')} 중 하나여야 해요` })
  field?: Field;
}

export class PopularQuery {
  @IsIn(['DAY', 'WEEK', 'MONTH'], { message: 'DAY, WEEK, MONTH 중 하나여야 해요' })
  period: PopularPeriod;

  @IsOptional()
  @IsIn(FIELDS, { message: `${FIELDS.join(', ')} 중 하나여야 해요` })
  field?: Field;
}

export class SecurityPopularQuery {
  @IsIn(['DAY', 'WEEK', 'MONTH'], { message: 'DAY, WEEK, MONTH 중 하나여야 해요' })
  period: PopularPeriod;

  @IsOptional()
  @IsIn(['DOMESTIC', 'OVERSEAS'], { message: 'DOMESTIC 또는 OVERSEAS여야 해요' })
  region?: NewsRegion;
}

export class SecurityNewsQuery {
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
  @IsIn(['DOMESTIC', 'OVERSEAS'], { message: 'DOMESTIC 또는 OVERSEAS여야 해요' })
  region?: NewsRegion;

  @IsOptional()
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(20, { message: '최대 20개까지 가능해요' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 해요' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 해요' })
  sourceIds?: number[];
}

export class RecordViewDto {
  @IsOptional()
  @IsUUID('all', { message: 'UUID 형식이어야 해요' })
  recommendationId?: string;
}
