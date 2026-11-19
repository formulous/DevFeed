export interface FieldError {
  field: string;
  message: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  fieldErrors?: FieldError[];
  [extra: string]: unknown;
}

export class AppException extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppException';
  }

  toBody(): ErrorBody {
    return { code: this.code, message: this.message, ...this.extra };
  }
}

export const Errors = {
  validation: (fieldErrors: FieldError[], message = '요청 값이 올바르지 않음') =>
    new AppException(400, 'VALIDATION_FAILED', message, { fieldErrors }),
  invalidCursor: () => new AppException(400, 'INVALID_CURSOR', '커서 값이 올바르지 않음'),
  unauthenticated: () => new AppException(401, 'UNAUTHENTICATED', '로그인이 필요함'),
  tokenExpired: () => new AppException(401, 'TOKEN_EXPIRED', '인증이 만료됨'),
  forbidden: () => new AppException(403, 'FORBIDDEN', '권한이 없음'),
  notFound: (message = '대상을 찾을 수 없음') => new AppException(404, 'NOT_FOUND', message),
  sourceFeedDuplicated: () =>
    new AppException(409, 'SOURCE_FEED_DUPLICATED', '이미 등록된 피드 URL임'),
  sourceFeedInvalid: (reason: string) =>
    new AppException(422, 'SOURCE_FEED_INVALID', `유효한 RSS/Atom 피드가 아님: ${reason}`),
  crawlAlreadyRunning: () =>
    new AppException(409, 'CRAWL_ALREADY_RUNNING', '해당 소스를 이미 수집 중임'),
  sourceInactive: () => new AppException(409, 'SOURCE_INACTIVE', '비활성 소스는 수집할 수 없음'),
  sourceNotInError: () =>
    new AppException(409, 'SOURCE_NOT_IN_ERROR', '오류 상태인 소스만 재개할 수 있음'),
  tagDuplicated: () => new AppException(409, 'TAG_DUPLICATED', '같은 이름 또는 slug의 태그가 있음'),
  synonymDuplicated: (synonym?: string) =>
    new AppException(
      409,
      'SYNONYM_DUPLICATED',
      synonym ? `동의어 '${synonym}'이(가) 다른 태그에 이미 있음` : '동의어가 다른 태그에 이미 있음',
    ),
  jobAlreadyRunning: () =>
    new AppException(409, 'JOB_ALREADY_RUNNING', '같은 작업이 이미 실행 중임'),
};
