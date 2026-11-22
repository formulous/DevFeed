import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IdParamPipe } from '../admin/id-param.pipe';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Errors } from '../common/errors/app.exception';
import { CommunityService } from './community.service';
import { AdminReportsQuery, CreateReportDto, ResolveReportDto } from './dto/community.dto';
import type { ReportTargetType } from './moderation';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.report(user, dto);
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class AdminCommunityController {
  constructor(
    private readonly reports: ReportsService,
    private readonly community: CommunityService,
  ) {}

  @Get('reports')
  list(@Query() query: AdminReportsQuery) {
    return this.reports.list(query);
  }

  @Put('reports/:targetType/:targetId')
  resolve(
    @Param('targetType') targetType: string,
    @Param('targetId', IdParamPipe) targetId: number,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (targetType !== 'POST' && targetType !== 'COMMENT') {
      throw Errors.validation([{ field: 'targetType', message: 'POST 또는 COMMENT여야 해요' }]);
    }
    return this.reports.resolve(user, targetType as ReportTargetType, targetId, dto.action);
  }

  @Put('community/posts/:postId/hidden')
  hide(@Param('postId', IdParamPipe) postId: number, @CurrentUser() user: AuthUser) {
    return this.community.setHidden(user, postId, true);
  }

  @Delete('community/posts/:postId/hidden')
  unhide(@Param('postId', IdParamPipe) postId: number, @CurrentUser() user: AuthUser) {
    return this.community.setHidden(user, postId, false);
  }
}
