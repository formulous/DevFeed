import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../common/errors/app.exception';
import { DataSource } from 'typeorm';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import { buildMatchQuery, MatchMode } from '../ingest/tokenizer';
import { searchSince } from '../posts/period';
import { withoutViewCount } from '../posts/post-cards';
import { DirectoryService } from '../posts/directory.service';
import { PostCardsService } from '../posts/post-cards.service';
import { CachedSearch, SearchCache, searchCacheKey } from './search-cache';
import { buildSearchQueries, SearchFilter, SearchScope, TOTAL_CAP } from './search-query';
import { SearchQueryDto } from './search.dto';

export const SEARCH_MATCH_MODE: MatchMode = 'PHRASE';

const SCOPE_FILTERS: Record<SearchScope, (keyof SearchQueryDto)[]> = {
  TECH: ['tagIds', 'sourceIds'],
  SECURITY: ['region'],
  COMMUNITY: ['category'],
};
const ALL_FILTERS: (keyof SearchQueryDto)[] = ['tagIds', 'sourceIds', 'region', 'category'];

@Injectable()
export class SearchService {
  private readonly cache = new SearchCache();

  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
    private readonly directory: DirectoryService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async search(query: SearchQueryDto, userId?: number, now = new Date()) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const scope = query.scope ?? 'TECH';
    const outside = ALL_FILTERS.filter((key) => query[key] !== undefined && !SCOPE_FILTERS[scope].includes(key));
    if (outside.length) {
      throw Errors.validation(outside.map((field) => ({ field, message: `${scope} 범위에서는 쓸 수 없는 필터예요` })));
    }
    const empty = { items: [], total: 0, totalCapped: false, page, size };
    const match = buildMatchQuery(query.q, SEARCH_MATCH_MODE);
    if (!match) return empty;
    let sourceIds = query.sourceIds;
    if (scope === 'SECURITY' && query.region) {
      sourceIds = (await this.directory.sourcesOf('SECURITY_NEWS')).filter((s) => s.region === query.region).map((s) => s.id);
      if (!sourceIds.length) return empty;
    }

    const period = query.period ?? 'ALL';
    const sort = query.sort ?? 'RELEVANCE';
    const filter: SearchFilter = {
      match,
      scope,
      category: query.category,
      tagIds: query.tagIds,
      sourceIds,
      since: searchSince(period, now),
      sort,
      limit: size,
      offset: (page - 1) * size,
    };
    const result = this.env.searchCacheEnabled && scope !== 'COMMUNITY'
      ? await this.cache.get(
          searchCacheKey({ match, scope, region: query.region, tagIds: query.tagIds, sourceIds: query.sourceIds, period, sort, page, size }),
          () => this.run(filter),
        )
      : await this.run(filter);
    const items = await this.cards.load(result.ids, userId);
    return { items: items.map(withoutViewCount), total: result.total, totalCapped: result.totalCapped, page, size };
  }

  private async run(filter: SearchFilter): Promise<CachedSearch> {
    const { list, count } = buildSearchQueries(filter);
    const [rows, totals] = await Promise.all([
      this.dataSource.query(list.sql, list.params) as Promise<{ id: number | string }[]>,
      this.dataSource.query(count.sql, count.params) as Promise<{ total: number | string }[]>,
    ]);
    const counted = Number(totals[0]?.total ?? 0);
    return {
      ids: rows.map((r) => Number(r.id)),
      total: Math.min(counted, TOTAL_CAP),
      totalCapped: counted > TOTAL_CAP,
    };
  }
}
