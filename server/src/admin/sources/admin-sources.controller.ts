import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { Errors } from '../../common/errors/app.exception';
import { CreateSourceDto, ListSourcesQuery, RunsQuery, UpdateSourceDto, ValidateFeedDto } from '../dto/source.dto';
import { IdParamPipe } from '../id-param.pipe';
import { AdminSourcesService } from './admin-sources.service';

@Controller('admin/sources')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class AdminSourcesController {
  constructor(private readonly sources: AdminSourcesService) {}

  @Get()
  list(@Query() query: ListSourcesQuery) {
    return this.sources.list(query.status, query.kind);
  }

  @Post()
  create(@Body() dto: CreateSourceDto) {
    return this.sources.create(dto);
  }

  @Post('validate')
  @HttpCode(200)
  validate(@Body() dto: ValidateFeedDto) {
    return this.sources.validate(dto.feedUrl);
  }

  @Get(':sourceId')
  get(@Param('sourceId', IdParamPipe) id: number) {
    return this.sources.get(id);
  }

  @Patch(':sourceId')
  update(@Param('sourceId', IdParamPipe) id: number, @Body() dto: UpdateSourceDto) {
    if (!Object.values(dto).some((v) => v !== undefined)) {
      throw Errors.validation([{ field: 'body', message: '수정할 필드가 하나 이상 필요함' }]);
    }
    return this.sources.update(id, dto);
  }

  @Get(':sourceId/runs')
  runs(@Param('sourceId', IdParamPipe) id: number, @Query() query: RunsQuery) {
    return this.sources.runs(id, query.size);
  }

  @Post(':sourceId/crawl')
  @HttpCode(202)
  crawl(@Param('sourceId', IdParamPipe) id: number) {
    return this.sources.crawlNow(id);
  }

  @Post(':sourceId/resume')
  @HttpCode(200)
  resume(@Param('sourceId', IdParamPipe) id: number) {
    return this.sources.resume(id);
  }
}
