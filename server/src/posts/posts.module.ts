import { Module } from '@nestjs/common';
import { PopularIdsService } from './popular-ids.service';
import { PostCardsService } from './post-cards.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { ViewsService } from './views.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, PostCardsService, PopularIdsService, ViewsService],
  exports: [PostCardsService],
})
export class PostsModule {}
