import { ApiError } from '@/api/http';

export function fieldErrorMap(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.body.fieldErrors) return {};
  return Object.fromEntries(error.body.fieldErrors.map((f) => [f.field, f.message]));
}

export function errorMessage(error: unknown, fallback = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요') {
  return error instanceof ApiError ? error.message : fallback;
}
