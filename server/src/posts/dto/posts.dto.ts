import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { toIdList, toInt } from '../../common/validation/query-transforms';
import type { NewsRegion } from '../../entities/source.entity';
import { FIELDS, type Field } from '../fields';
import type { PopularPeriod } from '../period';

export class FeedQuery {
  @IsOptional()
  @IsString({ message: '문자열이어야 함' })
  @MaxLength(200, { message: '최대 200자임' })
  cursor?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 함' })
  @Min(1, { message: '1 이상이어야 함' })
  @Max(50, { message: '50 이하여야 함' })
  size?: number;

  @IsOptional()
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 함' })
  @ArrayMaxSize(10, { message: '최대 10개임' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 함' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 함' })
  tagIds?: number[];

  @IsOptional()
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 함' })
  @ArrayMaxSize(20, { message: '최대 20개임' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 함' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 함' })
  sourceIds?: number[];

  @IsOptional()
  @IsIn(['COMPANY', 'PERSONAL'], { message: 'COMPANY 또는 PERSONAL이어야 함' })
  sourceType?: 'COMPANY' | 'PERSONAL';

  @IsOptional()
  @IsIn(FIELDS, { message: `${FIELDS.join(', ')} 중 하나여야 함` })
  field?: Field;
}

export class PopularQuery {
  @IsIn(['DAY', 'WEEK', 'MONTH'], { message: 'DAY, WEEK, MONTH 중 하나여야 함' })
  period: PopularPeriod;

  @IsOptional()
  @IsIn(FIELDS, { message: `${FIELDS.join(', ')} 중 하나여야 함` })
  field?: Field;
}

export class SecurityNewsQuery {
  @IsOptional()
  @IsString({ message: '문자열이어야 함' })
  @MaxLength(200, { message: '최대 200자임' })
  cursor?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 함' })
  @Min(1, { message: '1 이상이어야 함' })
  @Max(50, { message: '50 이하여야 함' })
  size?: number;

  @IsOptional()
  @IsIn(['DOMESTIC', 'OVERSEAS'], { message: 'DOMESTIC 또는 OVERSEAS여야 함' })
  region?: NewsRegion;

  @IsOptional()
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 함' })
  @ArrayMaxSize(20, { message: '최대 20개임' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 함' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 함' })
  sourceIds?: number[];
}

export class RecordViewDto {
  @IsOptional()
  @IsUUID('all', { message: 'UUID 형식이어야 함' })
  recommendationId?: string;
}
