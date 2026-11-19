import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Errors } from '../common/errors/app.exception';
import type { AccessTokenPayload, AuthUser } from './auth.types';
import { extractBearer } from './jwt-auth.guard';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header) return true;
    const token = extractBearer(header);
    if (!token) throw Errors.tokenExpired();
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (!Number.isSafeInteger(payload.sub) || (payload.role !== 'USER' && payload.role !== 'ADMIN')) {
        throw new Error('payload');
      }
      request.user = { id: payload.sub, role: payload.role };
    } catch {
      throw Errors.tokenExpired();
    }
    return true;
  }
}
