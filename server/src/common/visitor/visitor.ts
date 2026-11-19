import { createHash, randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { readCookie } from '../../auth/auth-policy';

export const VISITOR_COOKIE = 'df_vid';
const VISITOR_MAX_AGE_SEC = 365 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VisitorRequest = Request & { visitorId?: string };

export function visitorCookie(id: string, secure: boolean): string {
  const attributes = [`${VISITOR_COOKIE}=${id}`, 'Path=/', `Max-Age=${VISITOR_MAX_AGE_SEC}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function resolveVisitorId(cookieHeader: string | undefined): { id: string; issued: boolean } {
  const existing = readCookie(cookieHeader, VISITOR_COOKIE);
  if (existing && UUID.test(existing)) return { id: existing.toLowerCase(), issued: false };
  return { id: randomUUID(), issued: true };
}

export function viewerKey(viewer: { userId?: number; visitorId?: string }): Buffer {
  const raw = viewer.userId !== undefined ? `u:${viewer.userId}` : `a:${viewer.visitorId ?? ''}`;
  return createHash('sha256').update(raw).digest().subarray(0, 16);
}

export function visitorMiddleware(secure: boolean) {
  return (req: VisitorRequest, res: Response, next: NextFunction) => {
    const { id, issued } = resolveVisitorId(req.headers.cookie);
    req.visitorId = id;
    if (issued) res.append('Set-Cookie', visitorCookie(id, secure));
    next();
  };
}
