import { AppException } from '../common/errors/app.exception';
import { decodeRecommendationCursor, encodeRecommendationCursor, SnapshotStore, uuidToBuffer } from './snapshot';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AppException).code;
  }
  return null;
};

describe('recommendation cursor', () => {
  it('스냅샷 ID와 위치를 왕복함', () => {
    expect(decodeRecommendationCursor(encodeRecommendationCursor('abc', 20))).toEqual({ snapshotId: 'abc', offset: 20 });
    expect(codeOf(() => decodeRecommendationCursor('x'))).toBe('INVALID_CURSOR');
  });
});

describe('SnapshotStore', () => {
  it('만료·다른 회원·없는 스냅샷은 INVALID_CURSOR', () => {
    const store = new SnapshotStore(1000, 10);
    const s = store.save(1, [], false, 0);
    expect(store.get(s.id, 1, 1000).id).toBe(s.id);
    expect(codeOf(() => store.get(s.id, 2, 10))).toBe('INVALID_CURSOR');
    expect(codeOf(() => store.get(s.id, 1, 1001))).toBe('INVALID_CURSOR');
    expect(codeOf(() => store.get('none', 1, 0))).toBe('INVALID_CURSOR');
  });

  it('최대 개수를 넘으면 오래된 것부터 제거', () => {
    const store = new SnapshotStore(10_000, 2);
    const a = store.save(1, [], false, 0);
    store.save(1, [], false, 1);
    store.save(1, [], false, 2);
    expect(codeOf(() => store.get(a.id, 1, 3))).toBe('INVALID_CURSOR');
  });
});

describe('uuidToBuffer', () => {
  it('UNHEX(REPLACE(uuid, "-", ""))와 같은 16바이트', () => {
    const buf = uuidToBuffer('3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b');
    expect(buf).toHaveLength(16);
    expect(buf.toString('hex')).toBe('3f2a1b4c5d6e4f708a9b0c1d2e3f4a5b');
  });
});
