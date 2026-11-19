import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import { readCookie, REFRESH_COOKIE, refreshCookie } from './auth-policy';
import { AuthService, IssuedTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  private send(res: Response, issued: IssuedTokens) {
    res.setHeader('Set-Cookie', refreshCookie(issued.refreshToken, this.env.cookieSecure, this.auth.refreshMaxAgeSec));
    res.setHeader('Cache-Control', 'no-store');
    return issued.body;
  }

  private clear(res: Response) {
    res.setHeader('Set-Cookie', refreshCookie(null, this.env.cookieSecure, 0));
  }

  @Post('signup')
  @HttpCode(201)
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.signup(dto.email, dto.password, dto.nickname));
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.login(dto.email, dto.password));
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.send(res, await this.auth.refresh(readCookie(req.headers.cookie, REFRESH_COOKIE)));
    } catch (error) {
      this.clear(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req.headers.cookie, REFRESH_COOKIE));
    this.clear(res);
  }
}
