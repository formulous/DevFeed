import { Errors } from '../common/errors/app.exception';
import type { ReportTargetType } from './moderation';

export interface ReportCursor {
  at: Date;
  type: ReportTargetType;
  id: number;
}

export function encodeReportCursor(cursor: ReportCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.at.toISOString(), k: cursor.type, i: cursor.id })).toString('base64url');
}

export function decodeReportCursor(raw: string): ReportCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { t?: unknown; k?: unknown; i?: unknown } | null;
    const { t, k, i } = parsed ?? {};
    if (typeof t !== 'string' || (k !== 'POST' && k !== 'COMMENT') || typeof i !== 'number' || !Number.isSafeInteger(i) || i < 1) {
      throw new Error('shape');
    }
    const at = new Date(t);
    if (Number.isNaN(at.getTime())) throw new Error('date');
    return { at, type: k, id: i };
  } catch {
    throw Errors.invalidCursor();
  }
}
