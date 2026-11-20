import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { toIdList, toInt } from '../../common/validation/query-transforms';

export class UpdateMeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '문자열이어야 해요' })
  @Length(2, 20, { message: '2~20자로 입력해 주세요' })
  nickname: string;
}

export class WithdrawDto {
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 128, { message: '비밀번호를 입력해 주세요' })
  password: string;
}

export class InterestTagsDto {
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMinSize(3, { message: '3~10개를 골라 주세요' })
  @ArrayMaxSize(10, { message: '3~10개를 골라 주세요' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 해요' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 해요' })
  tagIds: number[];
}

export class MeListQuery {
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

export class BookmarkListQuery extends MeListQuery {
  @IsOptional()
  @Transform(toIdList)
  @IsArray({ message: '배열이어야 해요' })
  @ArrayMaxSize(10, { message: '최대 10개까지 가능해요' })
  @IsInt({ each: true, message: '1 이상 정수 목록이어야 해요' })
  @Min(1, { each: true, message: '1 이상 정수 목록이어야 해요' })
  tagIds?: number[];
}
