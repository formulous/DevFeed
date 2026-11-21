import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { refreshCookie } from '../auth/auth-policy';
import { AuthService } from '../auth/auth.service';
import { throttle } from '../common/http/rate-limit';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import { PasskeyLoginDto } from './dto/passkeys.dto';
import { PasskeysService } from './passkeys.service';

@Controller('auth/passkeys')
export class PasskeyLoginController {
  constructor(
    private readonly passkeys: PasskeysService,
    private readonly auth: AuthService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Throttle(throttle('login'))
  @Post('login/options')
  @HttpCode(200)
  async options(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.passkeys.loginOptions();
  }

  @Throttle(throttle('login'))
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: PasskeyLoginDto, @Res({ passthrough: true }) res: Response) {
    const issued = await this.passkeys.login(dto.credential);
    res.setHeader('Set-Cookie', refreshCookie(issued.refreshToken, this.env.cookieSecure, this.auth.refreshMaxAgeSec));
    res.setHeader('Cache-Control', 'no-store');
    return issued.body;
  }
}
