import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { toInt } from '../../common/validation/query-transforms';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCommentDto {
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 1000, { message: '댓글은 1~1,000자로 입력해 주세요' })
  content: string;

  @IsOptional()
  @IsInt({ message: '1 이상 정수여야 해요' })
  @Min(1, { message: '1 이상 정수여야 해요' })
  parentId?: number;
}

export class UpdateCommentDto {
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 1000, { message: '댓글은 1~1,000자로 입력해 주세요' })
  content: string;
}

export class CommentListQuery {
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
}
