import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { Errors } from '../../common/errors/app.exception';
import { CreateTagDto, TagsQuery, UpdateTagDto } from '../dto/tag.dto';
import { IdParamPipe } from '../id-param.pipe';
import { AdminTagsService } from './admin-tags.service';

@Controller('admin/tags')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class AdminTagsController {
  constructor(private readonly tags: AdminTagsService) {}

  @Get()
  list(@Query() query: TagsQuery) {
    return this.tags.list(query.q || undefined);
  }

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tags.create(dto);
  }

  @Post('retag')
  @HttpCode(202)
  retag() {
    return this.tags.startRetag();
  }

  @Patch(':tagId')
  update(@Param('tagId', IdParamPipe) id: number, @Body() dto: UpdateTagDto) {
    if (!Object.values(dto).some((v) => v !== undefined)) {
      throw Errors.validation([{ field: 'body', message: '수정할 필드가 하나 이상 필요해요' }]);
    }
    return this.tags.update(id, dto);
  }
}
