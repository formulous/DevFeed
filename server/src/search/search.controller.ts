import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { SearchQueryDto } from './search.dto';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(OptionalAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchQueryDto, @CurrentUser() user?: AuthUser) {
    return this.searchService.search(query, user?.id);
  }
}
