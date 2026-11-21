import { Controller, Delete, Param, Put, UseGuards } from '@nestjs/common';
import { IdParamPipe } from '../admin/id-param.pipe';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CommentsService } from './comments.service';

@Controller('admin/comments')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class AdminCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Put(':commentId/hidden')
  hide(@Param('commentId', IdParamPipe) commentId: number, @CurrentUser() user: AuthUser) {
    return this.comments.setHidden(user, commentId, true);
  }

  @Delete(':commentId/hidden')
  unhide(@Param('commentId', IdParamPipe) commentId: number, @CurrentUser() user: AuthUser) {
    return this.comments.setHidden(user, commentId, false);
  }
}
