import { AppException } from '../errors/app.exception';
import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('인코딩한 값을 그대로 복원함', () => {
    const at = new Date('2026-11-19T01:02:03.456Z');
    expect(decodeCursor(encodeCursor({ at, id: 42 }))).toEqual({ at, id: 42 });
  });

  it.each(['', 'abc', Buffer.from('{"t":"x","i":1}').toString('base64url'), Buffer.from('{"t":"2026-01-01T00:00:00Z","i":-1}').toString('base64url')])(
    '잘못된 커서는 INVALID_CURSOR (%s)',
    (raw) => {
      try {
        decodeCursor(raw);
        fail('should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe('INVALID_CURSOR');
      }
    },
  );
});
