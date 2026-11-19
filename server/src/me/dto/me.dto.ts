import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { toIdList, toInt } from '../../common/validation/query-transforms';

export class UpdateMeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '문자열이어야 함' })
  @Length(2, 20, { message: '2~20자여야 함' })
  nickname: string;
}

export class WithdrawDto {
  @IsString({ message: '문자열이어야 함' })
  @Length(1, 128, { message: '비밀번호를 입력해야 함' })
  password: string;
}

export class InterestTagsDto {
  @IsArray({ message: '배열이어야 함' })
  @ArrayMinSize(3, { message: '3~10개를 골라야 함' })
  @ArrayMaxSize(10, { message: '3~10개를 골라야 함' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 함' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 함' })
  tagIds: number[];
}

export class MeListQuery {
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
}

export class BookmarkListQuery extends MeListQuery {
  @IsOptional()
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 함' })
  @ArrayMaxSize(10, { message: '최대 10개임' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 함' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 함' })
  tagIds?: number[];
}
