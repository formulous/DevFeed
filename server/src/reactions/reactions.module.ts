import { Module } from '@nestjs/common';
import { AdminCommentsController } from './admin-comments.controller';
import { CommentsService } from './comments.service';
import { LikesService } from './likes.service';
import { ReactionsController } from './reactions.controller';

@Module({
  controllers: [ReactionsController, AdminCommentsController],
  providers: [LikesService, CommentsService],
})
export class ReactionsModule {}
