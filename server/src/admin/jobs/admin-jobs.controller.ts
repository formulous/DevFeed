import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { Errors } from '../../common/errors/app.exception';
import { JobsService } from './jobs.service';

@Controller('admin/jobs')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class AdminJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(':jobId')
  get(
    @Param('jobId', new ParseUUIDPipe({ exceptionFactory: () => Errors.notFound('작업을 찾을 수 없어요') }))
    jobId: string,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) throw Errors.notFound('작업을 찾을 수 없어요');
    return job;
  }
}
