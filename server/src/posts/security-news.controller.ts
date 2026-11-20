import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SecurityNewsQuery } from './dto/posts.dto';
import { PostsService } from './posts.service';

@Controller('security-news')
export class SecurityNewsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: SecurityNewsQuery, @CurrentUser() user?: AuthUser) {
    return this.posts.securityNews(query, user?.id);
  }

  @Get('sources')
  sources() {
    return this.posts.securityNewsSources();
  }
}
