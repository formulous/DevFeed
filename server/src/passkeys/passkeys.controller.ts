import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IdParamPipe } from '../admin/id-param.pipe';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PasskeyRegisterDto, UpdatePasskeyDto } from './dto/passkeys.dto';
import { PasskeysService } from './passkeys.service';

@Controller('me/passkeys')
@UseGuards(JwtAuthGuard)
export class PasskeysController {
  constructor(private readonly passkeys: PasskeysService) {}

  @Post('registration/options')
  @HttpCode(200)
  async options(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.passkeys.registrationOptions(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.passkeys.list(user.id);
  }

  @Post()
  @HttpCode(201)
  register(
    @CurrentUser() user: AuthUser,
    @Body() dto: PasskeyRegisterDto,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.passkeys.register(user.id, dto.credential, dto.name, userAgent);
  }

  @Patch(':passkeyId')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('passkeyId', IdParamPipe) passkeyId: number,
    @Body() dto: UpdatePasskeyDto,
  ) {
    return this.passkeys.rename(user.id, passkeyId, dto.name);
  }

  @Delete(':passkeyId')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('passkeyId', IdParamPipe) passkeyId: number): Promise<void> {
    await this.passkeys.remove(user.id, passkeyId);
  }
}
