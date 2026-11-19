import type { AdminSource, AdminTag, CrawlRun, Job } from '@/api/types';
import { mockSources } from './fixtures';

const NOW = Date.parse('2026-11-19T09:00:00.000Z');
const iso = (offsetMin: number) => new Date(NOW - offsetMin * 60_000).toISOString();

function seedSources(): AdminSource[] {
  return mockSources.map((s, i) => {
    const status = i === 6 ? 'ERROR' : i === 7 ? 'INACTIVE' : 'ACTIVE';
    return {
      ...s,
      status,
      lastSuccessAt: status === 'ERROR' ? iso(60 * 24 * 3) : iso(10 + i * 7),
      newPostCount7d: status === 'ACTIVE' ? 12 - i : 0,
      consecutiveFailures: status === 'ERROR' ? 7 : 0,
      siteUrl: `https://blog${s.id}.example.com`,
      feedUrl: `https://blog${s.id}.example.com/rss`,
      crawlIntervalMin: 60,
      nextCrawlAt: iso(-30),
      lastCrawledAt: iso(10),
      createdAt: iso(60 * 24 * 30),
      updatedAt: iso(60 * 24),
    };
  });
}

function seedRuns(source: AdminSource): CrawlRun[] {
  return Array.from({ length: 12 }, (_, i) => {
    const failed = source.status === 'ERROR' || i % 5 === 3;
    return {
      id: source.id * 1000 + (12 - i),
      triggerType: 'SCHEDULED',
      result: failed ? 'FAILURE' : i % 4 === 1 ? 'NOT_MODIFIED' : 'SUCCESS',
      startedAt: iso(i * 60 + 10),
      finishedAt: iso(i * 60 + 10 - 1),
      durationMs: failed ? 10_000 : 1200 + i * 30,
      attemptCount: failed ? 3 : 1,
      httpStatus: failed ? null : i % 4 === 1 ? 304 : 200,
      fetchedCount: failed ? 0 : 20,
      newPostCount: failed || i % 4 === 1 ? 0 : i % 3,
      updatedPostCount: 0,
      errorMessage: failed ? 'timeout (재시도 3회)' : null,
    };
  });
}

function seedTags(): AdminTag[] {
  return [
    { id: 1, name: 'Kafka', slug: 'kafka', category: '백엔드', synonyms: ['카프카'], postCount: 132 },
    { id: 2, name: 'Spring', slug: 'spring', category: '백엔드', synonyms: ['스프링', 'spring boot'], postCount: 410 },
    { id: 3, name: 'MySQL', slug: 'mysql', category: '데이터', synonyms: ['마이에스큐엘'], postCount: 220 },
    { id: 4, name: 'Redis', slug: 'redis', category: '데이터', synonyms: ['레디스'], postCount: 180 },
    { id: 5, name: 'React', slug: 'react', category: '프론트엔드', synonyms: ['리액트'], postCount: 512 },
    { id: 6, name: 'TypeScript', slug: 'typescript', category: '프론트엔드', synonyms: ['ts', '타입스크립트'], postCount: 301 },
    { id: 7, name: 'Kubernetes', slug: 'kubernetes', category: '인프라', synonyms: ['k8s', '쿠버네티스'], postCount: 1204 },
    { id: 8, name: 'LLM', slug: 'llm', category: 'AI', synonyms: ['대규모 언어 모델'], postCount: 95 },
  ];
}

export const adminState = {
  sources: seedSources(),
  runs: new Map<number, CrawlRun[]>(),
  tags: seedTags(),
  job: null as Job | null,
  nextId: 100,
};

export function resetAdminState() {
  adminState.sources = seedSources();
  adminState.runs = new Map(adminState.sources.map((s) => [s.id, seedRuns(s)]));
  adminState.tags = seedTags();
  adminState.job = null;
  adminState.nextId = 100;
}

resetAdminState();
