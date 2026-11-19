export interface CachedSearch {
  ids: number[];
  total: number;
  totalCapped: boolean;
}

export const SEARCH_CACHE_TTL_MS = 60_000;
export const SEARCH_CACHE_MAX_ENTRIES = 500;

export function searchCacheKey(input: {
  match: string;
  tagIds?: number[];
  sourceIds?: number[];
  period: string;
  sort: string;
  page: number;
  size: number;
}): string {
  const sorted = (ids?: number[]) => [...(ids ?? [])].sort((a, b) => a - b).join(',');
  return [input.match, sorted(input.tagIds), sorted(input.sourceIds), input.period, input.sort, input.page, input.size].join('|');
}

export class SearchCache {
  private readonly entries = new Map<string, { at: number; value: Promise<CachedSearch> }>();

  constructor(
    private readonly ttlMs = SEARCH_CACHE_TTL_MS,
    private readonly maxEntries = SEARCH_CACHE_MAX_ENTRIES,
  ) {}

  get(key: string, load: () => Promise<CachedSearch>, now = Date.now()): Promise<CachedSearch> {
    const hit = this.entries.get(key);
    if (hit && now - hit.at <= this.ttlMs) {
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit.value;
    }
    const value = load().catch((error) => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
      throw error;
    });
    this.entries.delete(key);
    this.entries.set(key, { at: now, value });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
    return value;
  }

  get size(): number {
    return this.entries.size;
  }
}
