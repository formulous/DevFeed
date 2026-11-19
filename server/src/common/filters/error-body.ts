import { AppException, ErrorBody } from '../errors/app.exception';

const STATUS_CODES: Record<number, { code: string; message: string }> = {
  400: { code: 'VALIDATION_FAILED', message: '요청 값이 올바르지 않음' },
  401: { code: 'UNAUTHENTICATED', message: '로그인이 필요함' },
  403: { code: 'FORBIDDEN', message: '권한이 없음' },
  404: { code: 'NOT_FOUND', message: '대상을 찾을 수 없음' },
  405: { code: 'NOT_FOUND', message: '대상을 찾을 수 없음' },
  409: { code: 'CONFLICT', message: '요청이 현재 상태와 충돌함' },
  413: { code: 'VALIDATION_FAILED', message: '요청 본문이 너무 큼' },
  429: { code: 'RATE_LIMITED', message: '요청이 너무 많음' },
};

interface StatusCarrier {
  getStatus(): number;
}

function hasStatus(value: unknown): value is StatusCarrier {
  return typeof (value as StatusCarrier)?.getStatus === 'function';
}

export function toErrorBody(exception: unknown): { status: number; body: ErrorBody } {
  if (exception instanceof AppException) {
    return { status: exception.status, body: exception.toBody() };
  }
  if (hasStatus(exception)) {
    const status = exception.getStatus();
    const mapped = STATUS_CODES[status];
    if (mapped) return { status, body: { ...mapped } };
    if (status >= 400 && status < 500) {
      return { status, body: { code: 'CONFLICT', message: '요청을 처리할 수 없음' } };
    }
  }
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생함' } };
}
