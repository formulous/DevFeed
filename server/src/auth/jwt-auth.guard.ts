import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Errors } from '../common/errors/app.exception';
import type { UserRole } from '../entities/user.entity';
import type { AccessTokenPayload, AuthUser } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearer(request.headers.authorization);
    if (!token) throw Errors.unauthenticated();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw Errors.tokenExpired();
    }
    if (!Number.isSafeInteger(payload.sub) || (payload.role !== 'USER' && payload.role !== 'ADMIN')) {
      throw Errors.tokenExpired();
    }
    request.user = { id: payload.sub, role: payload.role };

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(payload.role)) throw Errors.forbidden();
    return true;
  }
}
