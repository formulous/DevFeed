import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @MaxLength(255, { message: '최대 255자임' })
  @IsEmail({}, { message: '이메일 형식이 아님' })
  email: string;

  @IsString({ message: '문자열이어야 함' })
  @Length(1, 128, { message: '비밀번호를 입력해야 함' })
  password: string;
}
