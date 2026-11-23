import { Module } from '@nestjs/common';
import { WebFeedsController } from './web-feeds.controller';
import { WebFeedsService } from './web-feeds.service';

@Module({ controllers: [WebFeedsController], providers: [WebFeedsService] })
export class WebModule {}
