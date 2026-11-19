export const MINUTE = 60_000;

export const RATE_LIMITS = {
  default: { limit: 120, ttl: MINUTE },
  signup: { limit: 5, ttl: 10 * MINUTE },
  login: { limit: 10, ttl: MINUTE },
  refresh: { limit: 30, ttl: MINUTE },
  search: { limit: 60, ttl: MINUTE },
  views: { limit: 60, ttl: MINUTE },
} as const;

export const throttle = (key: Exclude<keyof typeof RATE_LIMITS, 'default'>) => ({ default: RATE_LIMITS[key] });
