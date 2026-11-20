import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @MaxLength(255, { message: '최대 255자까지 입력할 수 있어요' })
  @IsEmail({}, { message: '이메일 형식이 아니에요' })
  email: string;

  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 128, { message: '비밀번호를 입력해 주세요' })
  password: string;
}
