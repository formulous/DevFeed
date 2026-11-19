import { Controller, Get, Query } from '@nestjs/common';
import { PublicTagsQuery } from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('tags')
  tags(@Query() query: PublicTagsQuery) {
    return this.catalog.tags(query);
  }

  @Get('sources')
  sources() {
    return this.catalog.sources();
  }
}
