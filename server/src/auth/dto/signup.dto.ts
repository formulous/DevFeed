import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_RULE } from '../auth-policy';

export class SignupDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: '이메일 형식이 아님' })
  @MaxLength(255, { message: '최대 255자임' })
  email: string;

  @IsString({ message: '문자열이어야 함' })
  @Matches(PASSWORD_RULE, { message: '8~64자, 영문과 숫자를 포함해야 함 (공백·한글 불가)' })
  password: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '문자열이어야 함' })
  @Length(2, 20, { message: '2~20자여야 함' })
  nickname: string;
}
