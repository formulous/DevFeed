import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WebFeedsService } from './web-feeds.service';

export const WEB_FEED_PATHS = ['sitemap.xml', 'sitemap-:page', 'community/rss.xml'];

@Controller()
@SkipThrottle()
export class WebFeedsController {
  constructor(private readonly feeds: WebFeedsService) {}

  @Get('sitemap.xml')
  async sitemap(@Res() res: Response) {
    this.send(res, 'application/xml', await this.feeds.sitemap());
  }

  @Get('sitemap-:page')
  async sitemapPart(@Param('page') page: string, @Res() res: Response) {
    const match = /^([1-9][0-9]{0,4})\.xml$/.exec(page);
    this.send(res, 'application/xml', match ? await this.feeds.sitemapPart(Number(match[1])) : null);
  }

  @Get('community/rss.xml')
  async communityRss(@Res() res: Response) {
    this.send(res, 'application/rss+xml', await this.feeds.communityRss());
  }

  private send(res: Response, type: string, body: string | null): void {
    if (body === null) throw new NotFoundException();
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.type(`${type}; charset=utf-8`).send(body);
  }
}
