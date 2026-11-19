import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { toInt } from '../common/validation/query-transforms';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PublicTagsQuery {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 함' })
  @MaxLength(30, { message: '최대 30자임' })
  q?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 함' })
  @MaxLength(30, { message: '최대 30자임' })
  category?: string;

  @IsOptional()
  @IsIn(['NAME', 'POST_COUNT'], { message: 'NAME 또는 POST_COUNT여야 함' })
  sort?: 'NAME' | 'POST_COUNT';

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 함' })
  @Min(1, { message: '1 이상이어야 함' })
  @Max(500, { message: '500 이하여야 함' })
  size?: number;
}
