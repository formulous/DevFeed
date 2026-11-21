import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IdParamPipe } from '../admin/id-param.pipe';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { CommentsService } from './comments.service';
import { CommentListQuery, CreateCommentDto, UpdateCommentDto } from './dto/reactions.dto';
import { LikesService } from './likes.service';

@Controller()
export class ReactionsController {
  constructor(
    private readonly likes: LikesService,
    private readonly comments: CommentsService,
  ) {}

  @Put('posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  like(@Param('postId', IdParamPipe) postId: number, @CurrentUser() user: AuthUser) {
    return this.likes.set(user.id, postId, true);
  }

  @Delete('posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  unlike(@Param('postId', IdParamPipe) postId: number, @CurrentUser() user: AuthUser) {
    return this.likes.set(user.id, postId, false);
  }

  @Get('posts/:postId/comments')
  @UseGuards(OptionalAuthGuard)
  list(@Param('postId', IdParamPipe) postId: number, @Query() query: CommentListQuery, @CurrentUser() user?: AuthUser) {
    return this.comments.list(postId, query, user);
  }

  @Post('posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  create(@Param('postId', IdParamPipe) postId: number, @Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser) {
    return this.comments.create(user, postId, dto.content, dto.parentId);
  }

  @Get('comments/:commentId/replies')
  @UseGuards(OptionalAuthGuard)
  replies(@Param('commentId', IdParamPipe) commentId: number, @Query() query: CommentListQuery, @CurrentUser() user?: AuthUser) {
    return this.comments.replies(commentId, query, user);
  }

  @Patch('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  update(@Param('commentId', IdParamPipe) commentId: number, @Body() dto: UpdateCommentDto, @CurrentUser() user: AuthUser) {
    return this.comments.update(user, commentId, dto.content);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  remove(@Param('commentId', IdParamPipe) commentId: number, @CurrentUser() user: AuthUser) {
    return this.comments.remove(user, commentId);
  }
}
