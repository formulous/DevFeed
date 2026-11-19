import { Throttle } from '@nestjs/throttler';
import { throttle } from '../common/http/rate-limit';
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { IdParamPipe } from '../admin/id-param.pipe';
import type { VisitorRequest } from '../common/visitor/visitor';
import { FeedQuery, PopularQuery, RecordViewDto } from './dto/posts.dto';
import { PostsService } from './posts.service';
import { ViewsService } from './views.service';

@Controller('posts')
@UseGuards(OptionalAuthGuard)
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly views: ViewsService,
  ) {}

  @Get()
  feed(@Query() query: FeedQuery, @CurrentUser() user?: AuthUser) {
    return this.posts.feed(query, user?.id);
  }

  @Get('popular')
  popular(@Query() query: PopularQuery, @CurrentUser() user?: AuthUser) {
    return this.posts.popular(query.period, user?.id);
  }

  @Throttle(throttle('views'))
  @Post(':postId/views')
  @HttpCode(204)
  async view(
    @Param('postId', IdParamPipe) postId: number,
    @Body() dto: RecordViewDto,
    @Req() req: VisitorRequest,
    @CurrentUser() user?: AuthUser,
  ): Promise<void> {
    await this.views.record(postId, { userId: user?.id, visitorId: req.visitorId }, dto.recommendationId);
  }
}
