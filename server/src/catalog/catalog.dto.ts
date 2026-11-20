import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { toInt } from '../common/validation/query-transforms';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PublicTagsQuery {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @MaxLength(30, { message: '최대 30자까지 입력할 수 있어요' })
  q?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @MaxLength(30, { message: '최대 30자까지 입력할 수 있어요' })
  category?: string;

  @IsOptional()
  @IsIn(['NAME', 'POST_COUNT'], { message: 'NAME 또는 POST_COUNT여야 해요' })
  sort?: 'NAME' | 'POST_COUNT';

  @IsOptional()
  @Transform(toInt)
  @IsInt({ message: '정수여야 해요' })
  @Min(1, { message: '1 이상이어야 해요' })
  @Max(500, { message: '500 이하여야 해요' })
  size?: number;
}
