import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation/validation.pipe';
import { APP_ENV, AppEnv } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  app.useBodyParser('json', { limit: '100kb' });
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  const env = app.get<AppEnv>(APP_ENV);
  await app.listen(env.port);
}
void bootstrap();
