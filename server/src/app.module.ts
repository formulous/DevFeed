import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './common/database/database.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RATE_LIMITS } from './common/http/rate-limit';
import { APP_ENV, AppEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { CrawlModule } from './crawl/crawl.module';
import { PostsModule } from './posts/posts.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({
        throttlers: [{ name: 'default', ...RATE_LIMITS.default }],
        skipIf: () => !env.rateLimitEnabled,
      }),
    }),
    HealthModule, DatabaseModule, ScheduleModule.forRoot(), AuthModule, CrawlModule, AdminModule, CatalogModule, PostsModule, SearchModule, RecommendationsModule],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
