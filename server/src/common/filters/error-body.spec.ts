import { Errors } from '../errors/app.exception';
import { toErrorBody } from './error-body';

const httpLike = (status: number) => Object.assign(new Error('Cannot GET /x'), { getStatus: () => status });

describe('toErrorBody', () => {
  it('AppException은 code·message·추가 필드를 유지함', () => {
    expect(toErrorBody(Errors.validation([{ field: 'q', message: '2자 이상' }]))).toEqual({
      status: 400,
      body: { code: 'VALIDATION_FAILED', message: '요청 값이 올바르지 않음', fieldErrors: [{ field: 'q', message: '2자 이상' }] },
    });
  });

  it('Nest 기본 HTTP 예외는 공통 코드로 바꾸고 원문 메시지를 숨김', () => {
    expect(toErrorBody(httpLike(404))).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: '대상을 찾을 수 없음' } });
    expect(toErrorBody(httpLike(418))).toEqual({ status: 418, body: { code: 'CONFLICT', message: '요청을 처리할 수 없음' } });
  });

  it('알 수 없는 예외는 내부 정보를 숨긴 500', () => {
    expect(toErrorBody(new Error('ER_ACCESS_DENIED secret'))).toEqual({
      status: 500,
      body: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생함' },
    });
  });
});
