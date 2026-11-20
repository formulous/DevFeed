import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_RULE } from '../auth-policy';

export class SignupDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @MaxLength(255, { message: '최대 255자까지 입력할 수 있어요' })
  @IsEmail({}, { message: '이메일 형식이 아니에요' })
  email: string;

  @IsString({ message: '문자열이어야 해요' })
  @Matches(PASSWORD_RULE, { message: '8~64자로 영문과 숫자를 포함해 입력해 주세요 (공백·한글 불가)' })
  password: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '문자열이어야 해요' })
  @Length(2, 20, { message: '2~20자로 입력해 주세요' })
  nickname: string;
}
