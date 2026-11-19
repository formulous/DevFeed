import { Module } from '@nestjs/common';
import { CrawlModule } from '../crawl/crawl.module';
import { AdminJobsController } from './jobs/admin-jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { AdminSourcesController } from './sources/admin-sources.controller';
import { AdminSourcesService } from './sources/admin-sources.service';
import { AdminStatsController } from './stats/admin-stats.controller';
import { AdminTagsController } from './tags/admin-tags.controller';
import { AdminTagsService } from './tags/admin-tags.service';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [CrawlModule, CatalogModule],
  controllers: [AdminSourcesController, AdminTagsController, AdminStatsController, AdminJobsController],
  providers: [AdminSourcesService, AdminTagsService, JobsService],
})
export class AdminModule {}
