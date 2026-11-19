import { Injectable, Logger } from '@nestjs/common';
import { JobRegistry } from './job-registry';

export type { Job, JobContext, JobType } from './job-registry';

@Injectable()
export class JobsService extends JobRegistry {
  private static readonly logger = new Logger(JobsService.name);

  constructor() {
    super((job, error) => JobsService.logger.error(`작업 실패 ${job.type} ${job.id}: ${error.stack}`));
  }
}
