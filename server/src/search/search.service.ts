import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { buildMatchQuery, MatchMode } from '../ingest/tokenizer';
import { searchSince } from '../posts/period';
import { withoutViewCount } from '../posts/post-cards';
import { PostCardsService } from '../posts/post-cards.service';
import { buildSearchQueries } from './search-query';
import { SearchQueryDto } from './search.dto';

export const SEARCH_MATCH_MODE: MatchMode = 'PHRASE';

@Injectable()
export class SearchService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cards: PostCardsService,
  ) {}

  async search(query: SearchQueryDto, userId?: number, now = new Date()) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const match = buildMatchQuery(query.q, SEARCH_MATCH_MODE);
    if (!match) return { items: [], total: 0, page, size };

    const { list, count } = buildSearchQueries({
      match,
      tagIds: query.tagIds,
      sourceIds: query.sourceIds,
      since: searchSince(query.period ?? 'ALL', now),
      sort: query.sort ?? 'RELEVANCE',
      limit: size,
      offset: (page - 1) * size,
    });
    const [rows, totals] = await Promise.all([
      this.dataSource.query(list.sql, list.params) as Promise<{ id: number | string }[]>,
      this.dataSource.query(count.sql, count.params) as Promise<{ total: number | string }[]>,
    ]);
    const items = await this.cards.load(rows.map((r) => Number(r.id)), userId);
    return { items: items.map(withoutViewCount), total: Number(totals[0]?.total ?? 0), page, size };
  }
}
