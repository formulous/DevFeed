import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { TagCountsService } from './tag-counts.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, TagCountsService],
  exports: [TagCountsService],
})
export class CatalogModule {}
