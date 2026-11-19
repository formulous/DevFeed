import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_ENV, AppEnv } from '../config/env';
import { MeModule } from '../me/me.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';

@Global()
@Module({
  imports: [
    MeModule,
    JwtModule.registerAsync({
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({
        secret: env.jwt.accessSecret,
        signOptions: { expiresIn: env.jwt.accessTtlSec, algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [JwtAuthGuard, OptionalAuthGuard, AuthService],
  exports: [JwtModule, JwtAuthGuard, OptionalAuthGuard],
})
export class AuthModule {}
