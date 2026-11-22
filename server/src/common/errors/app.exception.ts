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
  validation: (fieldErrors: FieldError[], message = '요청 값이 올바르지 않아요') =>
    new AppException(400, 'VALIDATION_FAILED', message, { fieldErrors }),
  invalidCursor: () => new AppException(400, 'INVALID_CURSOR', '커서 값이 올바르지 않아요'),
  unauthenticated: () => new AppException(401, 'UNAUTHENTICATED', '로그인이 필요해요'),
  tokenExpired: () => new AppException(401, 'TOKEN_EXPIRED', '인증이 만료됐어요'),
  forbidden: () => new AppException(403, 'FORBIDDEN', '권한이 없어요'),
  notFound: (message = '대상을 찾을 수 없어요') => new AppException(404, 'NOT_FOUND', message),
  sourceFeedDuplicated: () =>
    new AppException(409, 'SOURCE_FEED_DUPLICATED', '이미 등록된 피드 URL이에요'),
  sourceFeedInvalid: (reason: string) =>
    new AppException(422, 'SOURCE_FEED_INVALID', `유효한 RSS/Atom 피드가 아니에요: ${reason}`),
  crawlAlreadyRunning: () =>
    new AppException(409, 'CRAWL_ALREADY_RUNNING', '해당 소스를 이미 수집 중이에요'),
  sourceInactive: () => new AppException(409, 'SOURCE_INACTIVE', '비활성 소스는 수집할 수 없어요'),
  sourceNotInError: () =>
    new AppException(409, 'SOURCE_NOT_IN_ERROR', '오류 상태인 소스만 재개할 수 있어요'),
  tagDuplicated: () => new AppException(409, 'TAG_DUPLICATED', '같은 이름 또는 slug의 태그가 이미 있어요'),
  synonymDuplicated: (synonym?: string) =>
    new AppException(
      409,
      'SYNONYM_DUPLICATED',
      synonym ? `동의어 '${synonym}'이(가) 다른 태그에 이미 있어요` : '동의어가 다른 태그에 이미 있어요',
    ),
  commentRateLimited: (retryAfterSec: number) =>
    new AppException(429, 'COMMENT_RATE_LIMITED', '잠시 후 다시 남겨 주세요', { retryAfterSec }),
  commentHidden: () => new AppException(409, 'COMMENT_HIDDEN', '관리자가 숨긴 댓글은 수정할 수 없어요'),
  passkeyNotFound: () =>
    new AppException(401, 'PASSKEY_NOT_FOUND', '이 패스키로 가입된 계정을 찾을 수 없어요'),
  passkeyVerificationFailed: (status: 400 | 401) =>
    new AppException(status, 'PASSKEY_VERIFICATION_FAILED', '패스키를 확인하지 못했어요. 다시 시도해 주세요'),
  passkeyLimitExceeded: () =>
    new AppException(409, 'PASSKEY_LIMIT_EXCEEDED', '패스키는 10개까지 만들 수 있어요'),
  passkeyAlreadyRegistered: () =>
    new AppException(409, 'PASSKEY_ALREADY_REGISTERED', '이미 등록된 패스키예요'),
  postWriteLimited: (reason: string, retryAfterSec: number, availableAt: Date) =>
    new AppException(429, 'POST_WRITE_LIMITED', '지금은 글을 쓸 수 없어요. 잠시 후 다시 시도해 주세요', {
      reason,
      retryAfterSec,
      availableAt: availableAt.toISOString(),
    }),
  communityPostClosed: () => new AppException(409, 'COMMUNITY_POST_CLOSED', '숨겨졌거나 삭제된 글이에요'),
  acceptNotQuestion: () => new AppException(409, 'ACCEPT_NOT_QUESTION', '질문글에서만 답을 채택할 수 있어요'),
  acceptOwnComment: () => new AppException(409, 'ACCEPT_OWN_COMMENT', '내 댓글은 채택할 수 없어요'),
  acceptReply: () => new AppException(409, 'ACCEPT_REPLY', '답글은 채택할 수 없어요'),
  commentAccepted: () => new AppException(409, 'COMMENT_ACCEPTED', '채택된 댓글은 삭제할 수 없어요'),
  reportOwnContent: () => new AppException(403, 'REPORT_OWN_CONTENT', '내 글이나 댓글은 신고할 수 없어요'),
  reportDuplicated: () => new AppException(409, 'REPORT_DUPLICATED', '이미 신고했어요'),
  jobAlreadyRunning: () =>
    new AppException(409, 'JOB_ALREADY_RUNNING', '같은 작업이 이미 실행 중이에요'),
};
