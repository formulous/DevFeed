import { Module } from '@nestjs/common';
import { CrawlSchedulerService } from './crawl-scheduler.service';
import { CrawlService } from './crawl.service';
import { FeedValidatorService } from './feed-validator.service';
import { MaintenanceService } from './maintenance.service';
import { PostIngestService } from './post-ingest.service';
import { TagDictionaryService } from './tag-dictionary.service';

@Module({
  providers: [
    TagDictionaryService,
    PostIngestService,
    FeedValidatorService,
    CrawlService,
    CrawlSchedulerService,
    MaintenanceService,
  ],
  exports: [TagDictionaryService, PostIngestService, FeedValidatorService, CrawlService],
})
export class CrawlModule {}
