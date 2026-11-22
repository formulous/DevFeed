import { decodeReportCursor, encodeReportCursor } from './report-cursor';

describe('report cursor', () => {
  it('시각·종류·ID를 그대로 되돌림', () => {
    const cursor = { at: new Date('2026-11-22T01:02:03.004Z'), type: 'COMMENT' as const, id: 42 };
    expect(decodeReportCursor(encodeReportCursor(cursor))).toEqual(cursor);
  });

  it('형식이 틀리면 INVALID_CURSOR', () => {
    const bad = Buffer.from(JSON.stringify({ t: '2026-11-22T00:00:00Z', k: 'USER', i: 1 })).toString('base64url');
    expect(() => decodeReportCursor(bad)).toThrow(expect.objectContaining({ code: 'INVALID_CURSOR' }));
    expect(() => decodeReportCursor('@@')).toThrow(expect.objectContaining({ code: 'INVALID_CURSOR' }));
  });
});
