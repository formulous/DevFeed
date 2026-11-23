import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APP_ENV } from '../config/env';
import type { AppEnv } from '../config/env';
import type { CommunityCategory } from '../posts/post-cards';
import { RSS_ITEMS, rss } from './rss';
import { SITEMAP_MAX_URLS, SITEMAP_STATIC_PATHS, SitemapEntry, sitemapIndex, sitemapPage, sitemapPageCount, urlset } from './sitemap';

export const WEB_FEED_TTL_MS = 10 * 60 * 1000;

const CATEGORY_LABEL: Record<CommunityCategory, string> = { QUESTION: '질문', DISCUSSION: '토론', SHARE: '공유' };

interface Entry {
  at: number;
  value: Promise<string | null>;
}

@Injectable()
export class WebFeedsService {
  private readonly cache = new Map<string, Entry>();

  constructor(
    private readonly dataSource: DataSource,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  sitemap(now = Date.now()): Promise<string | null> {
    return this.cached('sitemap', now, async () => {
      const pages = sitemapPageCount(await this.visibleCount());
      if (pages === 1) return this.sitemapPart(1);
      return sitemapIndex(Array.from({ length: pages }, (_, i) => this.url(`/sitemap-${i + 1}.xml`)));
    });
  }

  sitemapPart(page: number, now = Date.now()): Promise<string | null> {
    return this.cached(`sitemap-${page}`, now, async () => {
      const pages = sitemapPageCount(await this.visibleCount());
      if (!Number.isInteger(page) || page < 1 || page > pages) return null;
      const { postOffset, postLimit, includeStatic } = sitemapPage(page);
      const rows = (await this.dataSource.query(
        `SELECT post_id, published_at, edited_at FROM community_posts
          WHERE status = 'VISIBLE' ORDER BY post_id LIMIT ? OFFSET ?`,
        [postLimit, postOffset],
      )) as { post_id: number | string; published_at: Date; edited_at: Date | null }[];
      const entries: SitemapEntry[] = includeStatic ? SITEMAP_STATIC_PATHS.map((path) => ({ loc: this.url(path) })) : [];
      for (const r of rows) entries.push({ loc: this.url(`/community/posts/${r.post_id}`), lastmod: r.edited_at ?? r.published_at });
      return urlset(entries.slice(0, SITEMAP_MAX_URLS));
    });
  }

  communityRss(now = Date.now()): Promise<string | null> {
    return this.cached('community-rss', now, async () => {
      const rows = (await this.dataSource.query(
        `SELECT p.id, p.title, p.summary, cp.category, cp.published_at, u.nickname
           FROM community_posts cp
           JOIN posts p ON p.id = cp.post_id
           LEFT JOIN users u ON u.id = cp.user_id
          WHERE cp.status = 'VISIBLE'
          ORDER BY cp.published_at DESC, cp.post_id DESC LIMIT ?`,
        [RSS_ITEMS],
      )) as { id: number | string; title: string; summary: string | null; category: CommunityCategory; published_at: Date; nickname: string | null }[];
      return rss(
        {
          title: 'formulous 자유 게시판',
          link: this.url('/community'),
          self: this.url('/community/rss.xml'),
          description: 'formulous 자유 게시판 최신 글',
        },
        rows.map((r) => ({
          title: r.title,
          link: this.url(`/community/posts/${r.id}`),
          description: r.summary ?? '',
          publishedAt: r.published_at,
          author: r.nickname,
          category: CATEGORY_LABEL[r.category],
        })),
      );
    });
  }

  private async visibleCount(): Promise<number> {
    const [{ n }] = (await this.dataSource.query(
      "SELECT COUNT(*) AS n FROM community_posts WHERE status = 'VISIBLE'",
    )) as { n: number | string }[];
    return Number(n);
  }

  private url(path: string): string {
    return `${this.env.webBaseUrl}${path}`;
  }

  private cached(key: string, now: number, load: () => Promise<string | null>): Promise<string | null> {
    let entry = this.cache.get(key);
    if (!entry || now - entry.at > WEB_FEED_TTL_MS) {
      const value = load().catch((error) => {
        if (this.cache.get(key)?.value === value) this.cache.delete(key);
        throw error;
      });
      entry = { at: now, value };
      this.cache.set(key, entry);
    }
    return entry.value;
  }
}
