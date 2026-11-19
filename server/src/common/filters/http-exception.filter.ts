import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { toErrorBody } from './error-body';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = toErrorBody(exception);
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    if (body.code === 'LOGIN_LOCKED' && typeof body.retryAfterSec === 'number') {
      res.setHeader('Retry-After', String(body.retryAfterSec));
    }
    res.status(status).json(body);
  }
}
