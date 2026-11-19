import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createValidationPipe } from './common/validation/validation.pipe';
import { visitorMiddleware } from './common/visitor/visitor';
import { APP_ENV } from './config/env';
import type { AppEnv } from './config/env';

export function configureApp(app: INestApplication): AppEnv {
  const env = app.get<AppEnv>(APP_ENV);
  const express = app as NestExpressApplication;
  express.setGlobalPrefix('api');
  express.use(visitorMiddleware(env.cookieSecure));
  express.useGlobalPipes(createValidationPipe());
  express.useBodyParser('json', { limit: '100kb' });
  express.disable('x-powered-by');
  return env;
}
