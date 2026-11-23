import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IdParamPipe } from '../admin/id-param.pipe';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { CommunityService } from './community.service';
import {
  AcceptCommentDto,
  CommunityListQuery,
  CommunityPopularQuery,
  CreateCommunityPostDto,
  UpdateCommunityPostDto,
} from './dto/community.dto';

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: CommunityListQuery, @CurrentUser() user?: AuthUser) {
    return this.community.list(query, user?.id);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  create(@Body() dto: CreateCommunityPostDto, @CurrentUser() user: AuthUser) {
    return this.community.create(user, dto);
  }

  @Get('popular')
  @UseGuards(OptionalAuthGuard)
  popular(@Query() query: CommunityPopularQuery, @CurrentUser() user?: AuthUser) {
    return this.community.popular(query.period, query.category, user?.id, Date.now(), query.sort ?? 'SCORE', query.size);
  }

  @Get('write-status')
  @UseGuards(JwtAuthGuard)
  writeStatus(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.community.writeStatus(user.id);
  }

  @Get('posts/:postId')
  @UseGuards(OptionalAuthGuard)
  detail(@Param('postId', IdParamPipe) postId: number, @CurrentUser() user?: AuthUser) {
    return this.community.detail(postId, user);
  }

  @Patch('posts/:postId')
  @UseGuards(JwtAuthGuard)
  update(@Param('postId', IdParamPipe) postId: number, @Body() dto: UpdateCommunityPostDto, @CurrentUser() user: AuthUser) {
    return this.community.update(user, postId, dto);
  }

  @Delete('posts/:postId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@Param('postId', IdParamPipe) postId: number, @CurrentUser() user: AuthUser): Promise<void> {
    await this.community.remove(user, postId);
  }

  @Put('posts/:postId/accepted-comment')
  @UseGuards(JwtAuthGuard)
  accept(@Param('postId', IdParamPipe) postId: number, @Body() dto: AcceptCommentDto, @CurrentUser() user: AuthUser) {
    return this.community.accept(user, postId, dto.commentId);
  }

  @Delete('posts/:postId/accepted-comment')
  @UseGuards(JwtAuthGuard)
  unaccept(@Param('postId', IdParamPipe) postId: number, @CurrentUser() user: AuthUser) {
    return this.community.accept(user, postId, null);
  }
}
