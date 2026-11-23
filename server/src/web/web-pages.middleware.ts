import type { NextFunction, Request, Response } from 'express';
import type { WebPagesService } from './web-pages.service';

const NOT_PAGE = /^\/(api|sitemap[^/]*\.xml$|community\/rss\.xml$)/;

export function isPagePath(path: string): boolean {
  if (NOT_PAGE.test(path)) return false;
  const last = path.split('/').pop() ?? '';
  return !last.includes('.');
}

export function webPagesMiddleware(pages: WebPagesService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !isPagePath(req.path)) return next();
    pages
      .render(req.path)
      .then((page) => {
        if (!page) return next();
        res.status(page.status);
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.type('text/html; charset=utf-8').send(page.html);
      })
      .catch(next);
  };
}
