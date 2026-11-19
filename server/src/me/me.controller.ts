import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IdParamPipe } from '../admin/id-param.pipe';
import { refreshCookie } from '../auth/auth-policy';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import { BookmarkListQuery, InterestTagsDto, MeListQuery, UpdateMeDto, WithdrawDto } from './dto/me.dto';
import { MeService } from './me.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly me: MeService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.me.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.me.updateNickname(user.id, dto.nickname);
  }

  @Post('withdraw')
  @HttpCode(204)
  async withdraw(
    @CurrentUser() user: AuthUser,
    @Body() dto: WithdrawDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.me.withdraw(user.id, dto.password);
    res.setHeader('Set-Cookie', refreshCookie(null, this.env.cookieSecure, 0));
  }

  @Post('onboarding/complete')
  @HttpCode(204)
  async completeOnboarding(@CurrentUser() user: AuthUser): Promise<void> {
    await this.me.completeOnboarding(user.id);
  }

  @Get('interest-tags')
  interestTags(@CurrentUser() user: AuthUser) {
    return this.me.interestTags(user.id);
  }

  @Put('interest-tags')
  replaceInterestTags(@CurrentUser() user: AuthUser, @Body() dto: InterestTagsDto) {
    return this.me.replaceInterestTags(user.id, dto.tagIds);
  }

  @Get('bookmarks')
  bookmarks(@CurrentUser() user: AuthUser, @Query() query: BookmarkListQuery) {
    return this.me.bookmarks(user.id, query);
  }

  @Put('bookmarks/:postId')
  @HttpCode(204)
  async addBookmark(@CurrentUser() user: AuthUser, @Param('postId', IdParamPipe) postId: number): Promise<void> {
    await this.me.addBookmark(user.id, postId);
  }

  @Delete('bookmarks/:postId')
  @HttpCode(204)
  async removeBookmark(@CurrentUser() user: AuthUser, @Param('postId', IdParamPipe) postId: number): Promise<void> {
    await this.me.removeBookmark(user.id, postId);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() query: MeListQuery) {
    return this.me.history(user.id, query);
  }

  @Delete('history')
  @HttpCode(204)
  async clearHistory(@CurrentUser() user: AuthUser): Promise<void> {
    await this.me.removeHistory(user.id);
  }

  @Delete('history/:postId')
  @HttpCode(204)
  async removeHistory(@CurrentUser() user: AuthUser, @Param('postId', IdParamPipe) postId: number): Promise<void> {
    await this.me.removeHistory(user.id, postId);
  }
}
