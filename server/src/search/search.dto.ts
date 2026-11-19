import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { toIdList, toInt } from '../common/validation/query-transforms';
import type { SearchPeriod } from '../posts/period';
import type { SearchSort } from './search-query';

@ValidatorConstraint({ name: 'searchLength' })
class SearchLength implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const length = Array.from(value).length;
    return length >= 2 && length <= 50;
  }

  defaultMessage(): string {
    return '검색어는 2~50자여야 함';
  }
}

export class SearchQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString({ message: '검색어는 2~50자여야 함' })
  @Validate(SearchLength)
  q: string;

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
  @IsIn(['1W', '1M', '1Y', 'ALL'], { message: '1W, 1M, 1Y, ALL 중 하나여야 함' })
  period?: SearchPeriod;

  @IsOptional()
  @IsIn(['RELEVANCE', 'LATEST'], { message: 'RELEVANCE 또는 LATEST여야 함' })
  sort?: SearchSort;

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 함' })
  @Min(1, { message: '1 이상이어야 함' })
  @Max(50, { message: '50 이하여야 함' })
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 함' })
  @Min(1, { message: '1 이상이어야 함' })
  @Max(50, { message: '50 이하여야 함' })
  size?: number;
}
