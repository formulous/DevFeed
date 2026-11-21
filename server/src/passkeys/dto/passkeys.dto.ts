import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PasskeyLoginDto {
  @IsObject({ message: '패스키 응답이 필요해요' })
  credential: Record<string, unknown>;
}

export class PasskeyRegisterDto {
  @IsObject({ message: '패스키 응답이 필요해요' })
  credential: Record<string, unknown>;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 40, { message: '이름은 1~40자로 입력해 주세요' })
  name?: string;
}

export class UpdatePasskeyDto {
  @Transform(trim)
  @IsString({ message: '문자열이어야 해요' })
  @Length(1, 40, { message: '이름은 1~40자로 입력해 주세요' })
  name: string;
}
