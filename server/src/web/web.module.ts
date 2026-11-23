import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { WebFeedsController } from './web-feeds.controller';
import { WebFeedsService } from './web-feeds.service';
import { WebPagesService } from './web-pages.service';
import { WebTemplateService } from './web-template.service';

@Module({
  imports: [CommunityModule],
  controllers: [WebFeedsController],
  providers: [WebFeedsService, WebTemplateService, WebPagesService],
})
export class WebModule {}
