import { SearchCache, searchCacheKey } from './search-cache';

const result = { ids: [1], total: 1, totalCapped: false };

describe('searchCacheKey', () => {
  it('ID 목록 순서와 무관하게 같은 키', () => {
    const base = { match: '+a', period: 'ALL', sort: 'RELEVANCE', page: 1, size: 20 };
    expect(searchCacheKey({ ...base, tagIds: [2, 1] })).toBe(searchCacheKey({ ...base, tagIds: [1, 2] }));
    expect(searchCacheKey({ ...base, page: 2 })).not.toBe(searchCacheKey(base));
  });
});

describe('SearchCache', () => {
  it('TTL 안에서는 다시 불러오지 않고, 지나면 다시 불러옴', async () => {
    const cache = new SearchCache(1000, 10);
    const load = jest.fn(async () => result);
    await cache.get('k', load, 0);
    await cache.get('k', load, 1000);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get('k', load, 1001);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('실패한 결과는 캐시하지 않음', async () => {
    const cache = new SearchCache(1000, 10);
    await expect(cache.get('k', async () => { throw new Error('db'); }, 0)).rejects.toThrow('db');
    const load = jest.fn(async () => result);
    await cache.get('k', load, 1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('최대 개수를 넘으면 가장 오래 안 쓴 항목부터 버림', async () => {
    const cache = new SearchCache(10_000, 2);
    const load = async () => result;
    await cache.get('a', load, 0);
    await cache.get('b', load, 0);
    await cache.get('a', load, 1);
    await cache.get('c', load, 2);
    const reload = jest.fn(load);
    await cache.get('a', reload, 3);
    await cache.get('b', reload, 3);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(2);
  });
});
