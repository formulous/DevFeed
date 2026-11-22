import { Controller, Get, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { startOfKstDay } from '../../common/time/time';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class AdminStatsController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async get() {
    const [row] = (await this.dataSource.query(
      `SELECT
         (SELECT COALESCE(SUM(new_post_count), 0) FROM crawl_runs WHERE started_at >= ?) AS today_new,
         (SELECT COUNT(*) FROM sources WHERE status = 'ERROR' AND kind <> 'COMMUNITY') AS failing,
         (SELECT COUNT(*) FROM sources WHERE status = 'ACTIVE' AND kind <> 'COMMUNITY') AS active`,
      [startOfKstDay(new Date())],
    )) as { today_new: number | string; failing: number | string; active: number | string }[];
    return {
      todayNewPostCount: Number(row.today_new),
      failingSourceCount: Number(row.failing),
      activeSourceCount: Number(row.active),
    };
  }
}
