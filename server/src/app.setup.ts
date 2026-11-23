import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { securityHeaders } from './common/http/security-headers';
import { createValidationPipe } from './common/validation/validation.pipe';
import { visitorMiddleware } from './common/visitor/visitor';
import { APP_ENV } from './config/env';
import { WEB_FEED_PATHS } from './web/web-feeds.controller';
import { webPagesMiddleware } from './web/web-pages.middleware';
import { WebPagesService } from './web/web-pages.service';
import type { AppEnv } from './config/env';

export function configureApp(app: INestApplication): AppEnv {
  const env = app.get<AppEnv>(APP_ENV);
  const express = app as NestExpressApplication;
  express.set('trust proxy', 'loopback');
  express.setGlobalPrefix('api', { exclude: WEB_FEED_PATHS });
  express.use(securityHeaders);
  express.use(webPagesMiddleware(app.get(WebPagesService)));
  express.use(visitorMiddleware(env.cookieSecure));
  express.useGlobalPipes(createValidationPipe());
  express.useBodyParser('json', { limit: '100kb' });
  express.disable('x-powered-by');
  return env;
}
