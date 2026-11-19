import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { SourceStatus, SourceType } from '../../entities/source.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };

export class CreateSourceDto {
  @Transform(trim)
  @IsString({ message: '문자열이어야 함' })
  @Length(1, 100, { message: '1~100자여야 함' })
  name: string;

  @Transform(trim)
  @IsUrl(URL_OPTIONS, { message: 'http(s) URL이어야 함' })
  @MaxLength(2048, { message: '최대 2048자임' })
  siteUrl: string;

  @Transform(trim)
  @IsUrl(URL_OPTIONS, { message: 'http(s) URL이어야 함' })
  @MaxLength(2048, { message: '최대 2048자임' })
  feedUrl: string;

  @IsIn(['COMPANY', 'PERSONAL'], { message: 'COMPANY 또는 PERSONAL이어야 함' })
  type: SourceType;

  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsUrl(URL_OPTIONS, { message: 'http(s) URL이어야 함' })
  @MaxLength(2048, { message: '최대 2048자임' })
  logoUrl?: string | null;

  @IsOptional()
  @IsInt({ message: '정수여야 함' })
  @Min(30, { message: '30분 이상이어야 함' })
  @Max(1440, { message: '1440분 이하여야 함' })
  crawlIntervalMin?: number;
}

export class UpdateSourceDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 함' })
  @Length(1, 100, { message: '1~100자여야 함' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl(URL_OPTIONS, { message: 'http(s) URL이어야 함' })
  @MaxLength(2048, { message: '최대 2048자임' })
  siteUrl?: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl(URL_OPTIONS, { message: 'http(s) URL이어야 함' })
  @MaxLength(2048, { message: '최대 2048자임' })
  feedUrl?: string;

  @IsOptional()
  @IsIn(['COMPANY', 'PERSONAL'], { message: 'COMPANY 또는 PERSONAL이어야 함' })
  type?: SourceType;

  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsUrl(URL_OPTIONS, { message: 'http(s) URL이어야 함' })
  @MaxLength(2048, { message: '최대 2048자임' })
  logoUrl?: string | null;

  @IsOptional()
  @IsInt({ message: '정수여야 함' })
  @Min(30, { message: '30분 이상이어야 함' })
  @Max(1440, { message: '1440분 이하여야 함' })
  crawlIntervalMin?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'ACTIVE 또는 INACTIVE여야 함' })
  status?: Extract<SourceStatus, 'ACTIVE' | 'INACTIVE'>;
}

export class ValidateFeedDto {
  @Transform(trim)
  @IsUrl(URL_OPTIONS, { message: 'http(s) URL이어야 함' })
  @MaxLength(2048, { message: '최대 2048자임' })
  feedUrl: string;
}

export class ListSourcesQuery {
  @IsOptional()
  @IsIn(['ACTIVE', 'ERROR', 'INACTIVE'], { message: 'ACTIVE, ERROR, INACTIVE 중 하나여야 함' })
  status?: SourceStatus;
}

export class RunsQuery {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt({ message: '정수여야 함' })
  @Min(1, { message: '1 이상이어야 함' })
  @Max(50, { message: '50 이하여야 함' })
  size?: number;
}
