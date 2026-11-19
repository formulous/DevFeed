import { Errors } from '../errors/app.exception';

export interface TimeIdCursor {
  at: Date;
  id: number;
}

export function encodeCursor(cursor: TimeIdCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.at.toISOString(), i: cursor.id })).toString(
    'base64url',
  );
}

export function decodeCursor(raw: string): TimeIdCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) throw new Error('shape');
    const { t, i } = parsed as { t?: unknown; i?: unknown };
    if (typeof t !== 'string' || typeof i !== 'number' || !Number.isSafeInteger(i) || i < 1) {
      throw new Error('shape');
    }
    const at = new Date(t);
    if (Number.isNaN(at.getTime())) throw new Error('date');
    return { at, id: i };
  } catch {
    throw Errors.invalidCursor();
  }
}
