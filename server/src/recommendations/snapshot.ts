import { randomUUID } from 'node:crypto';
import { Errors } from '../common/errors/app.exception';
import type { RankedItem } from './scoring';

export const SNAPSHOT_TTL_MS = 10 * 60 * 1000;
export const MAX_SNAPSHOTS = 2000;

export interface Snapshot {
  id: string;
  userId: number;
  items: RankedItem[];
  fallback: boolean;
  at: number;
}

export function encodeRecommendationCursor(snapshotId: string, offset: number): string {
  return Buffer.from(JSON.stringify({ s: snapshotId, o: offset })).toString('base64url');
}

export function decodeRecommendationCursor(raw: string): { snapshotId: string; offset: number } {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { s?: unknown; o?: unknown };
    if (typeof parsed.s !== 'string' || typeof parsed.o !== 'number' || !Number.isSafeInteger(parsed.o) || parsed.o < 0) {
      throw new Error('shape');
    }
    return { snapshotId: parsed.s, offset: parsed.o };
  } catch {
    throw Errors.invalidCursor();
  }
}

export class SnapshotStore {
  private readonly snapshots = new Map<string, Snapshot>();

  constructor(
    private readonly ttlMs = SNAPSHOT_TTL_MS,
    private readonly max = MAX_SNAPSHOTS,
  ) {}

  save(userId: number, items: RankedItem[], fallback: boolean, now = Date.now()): Snapshot {
    const snapshot = { id: randomUUID(), userId, items, fallback, at: now };
    this.snapshots.set(snapshot.id, snapshot);
    for (const [id, s] of this.snapshots) {
      if (this.snapshots.size <= this.max && now - s.at <= this.ttlMs) break;
      this.snapshots.delete(id);
    }
    return snapshot;
  }

  get(snapshotId: string, userId: number, now = Date.now()): Snapshot {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot || snapshot.userId !== userId || now - snapshot.at > this.ttlMs) throw Errors.invalidCursor();
    return snapshot;
  }
}

export function uuidToBuffer(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}
