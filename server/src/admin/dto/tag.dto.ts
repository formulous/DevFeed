import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimList = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateTagDto {
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 50, { message: '1~50자여야 해요' })
  name: string;

  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @MaxLength(60, { message: '최대 60자까지 입력할 수 있어요' })
  @Matches(SLUG, { message: '영소문자·숫자·하이픈만 쓸 수 있어요' })
  slug: string;

  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 30, { message: '1~30자여야 해요' })
  category?: string | null;

  @IsOptional()
  @Transform(trimList)
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(20, { message: '최대 20개까지 가능해요' })
  @IsString({ each: true, message: '문자열이어야 해요' })
  @Length(1, 100, { each: true, message: '각 1~100자여야 해요' })
  synonyms?: string[];
}

export class UpdateTagDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 50, { message: '1~50자여야 해요' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @MaxLength(60, { message: '최대 60자까지 입력할 수 있어요' })
  @Matches(SLUG, { message: '영소문자·숫자·하이픈만 쓸 수 있어요' })
  slug?: string;

  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 30, { message: '1~30자여야 해요' })
  category?: string | null;

  @IsOptional()
  @Transform(trimList)
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(20, { message: '최대 20개까지 가능해요' })
  @IsString({ each: true, message: '문자열이어야 해요' })
  @Length(1, 100, { each: true, message: '각 1~100자여야 해요' })
  synonyms?: string[];
}

export class TagsQuery {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @MaxLength(30, { message: '최대 30자까지 입력할 수 있어요' })
  q?: string;
}
