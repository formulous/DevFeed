import { Module } from '@nestjs/common';
import { PostCardsService } from './post-cards.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { ViewsService } from './views.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, PostCardsService, ViewsService],
  exports: [PostCardsService],
})
export class PostsModule {}
