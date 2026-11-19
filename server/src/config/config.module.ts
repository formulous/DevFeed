import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_ENV, loadEnv } from './env';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', ignoreEnvFile: false })],
  providers: [{ provide: APP_ENV, useFactory: () => loadEnv(process.env) }],
  exports: [APP_ENV],
})
export class AppConfigModule {}
