import { Injectable } from '@nestjs/common';
import { FeedFetchError, fetchFeed } from '../ingest/feed-fetcher';
import { FeedParseError, ParsedFeed, parseFeed } from '../ingest/feed-parser';
import { makeTitle } from '../ingest/text';

export type FeedCheck = { ok: true; feed: ParsedFeed } | { ok: false; reason: string };

@Injectable()
export class FeedValidatorService {
  async check(feedUrl: string): Promise<FeedCheck> {
    try {
      const result = await fetchFeed(feedUrl, {}, { maxRetries: 0 });
      if (result.kind !== 'ok') return { ok: false, reason: '피드 응답이 없어요' };
      return { ok: true, feed: parseFeed(result.body) };
    } catch (error) {
      if (error instanceof FeedFetchError) return { ok: false, reason: error.message };
      if (error instanceof FeedParseError) return { ok: false, reason: error.message };
      throw error;
    }
  }

  static sampleTitles(feed: ParsedFeed, limit = 5): string[] {
    return feed.items
      .map((item) => makeTitle(item.title))
      .filter((title): title is string => !!title)
      .slice(0, limit);
  }
}
