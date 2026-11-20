import { Module } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { PopularIdsService } from './popular-ids.service';
import { PostCardsService } from './post-cards.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { SecurityNewsController } from './security-news.controller';
import { ViewsService } from './views.service';

@Module({
  controllers: [PostsController, SecurityNewsController],
  providers: [PostsService, PostCardsService, PopularIdsService, DirectoryService, ViewsService],
  exports: [PostCardsService, DirectoryService],
})
export class PostsModule {}
