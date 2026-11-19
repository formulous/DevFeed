import { http, HttpResponse } from 'msw';
import type { AdminSource, AdminTag, CrawlRun, SourceInput, TagInput, UpdateSourceInput } from '@/api/types';
import { adminState } from './adminFixtures';

export const MOCK_CRAWL_MS = 2500;
export const MOCK_RETAG_STEP = 400;

type Guard = (request: Request) => Response | null;

const err = (status: number, code: string, message: string) => HttpResponse.json({ code, message }, { status });

function settleRuns(runs: CrawlRun[]) {
  const now = Date.now();
  for (const run of runs) {
    if (run.result === 'RUNNING' && now - Date.parse(run.startedAt) >= MOCK_CRAWL_MS) {
      Object.assign(run, {
        result: 'SUCCESS',
        finishedAt: new Date(now).toISOString(),
        durationMs: now - Date.parse(run.startedAt),
        httpStatus: 200,
        fetchedCount: 20,
        newPostCount: 1,
      });
    }
  }
  return runs;
}

function feedCheck(feedUrl: string, excludeId?: number) {
  if (!/^https?:\/\//.test(feedUrl)) return { valid: false, reason: 'URL 형식이 아님' };
  if (feedUrl.includes('invalid')) return { valid: false, reason: 'RSS/Atom 아님' };
  if (feedUrl.includes('timeout')) return { valid: false, reason: 'timeout' };
  const duplicated = adminState.sources.some((s) => s.feedUrl === feedUrl && s.id !== excludeId);
  return {
    valid: true,
    format: 'RSS' as const,
    feedTitle: '예시 기술 블로그',
    itemCount: 20,
    sampleTitles: ['첫 번째 글', '두 번째 글', '세 번째 글'],
    duplicated,
  };
}

function findSource(id: unknown) {
  return adminState.sources.find((s) => s.id === Number(id));
}

function tagConflict(input: Partial<TagInput>, excludeId?: number) {
  const others = adminState.tags.filter((t) => t.id !== excludeId);
  if (others.some((t) => t.name.toLowerCase() === input.name?.toLowerCase() || t.slug === input.slug)) {
    return err(409, 'TAG_DUPLICATED', '같은 이름 또는 slug의 태그가 있음');
  }
  const syn = new Set(others.flatMap((t) => t.synonyms.map((s) => s.toLowerCase())));
  if (input.synonyms?.some((s) => syn.has(s.toLowerCase()))) {
    return err(409, 'SYNONYM_DUPLICATED', '다른 태그에 이미 등록된 동의어가 있음');
  }
  return null;
}

function progressJob() {
  const job = adminState.job;
  if (!job || job.status !== 'RUNNING') return job;
  job.processed = Math.min(job.total, job.processed + MOCK_RETAG_STEP);
  if (job.processed >= job.total) {
    job.status = 'SUCCEEDED';
    job.finishedAt = new Date().toISOString();
  }
  return job;
}

export function adminHandlers(guard: Guard) {
  type Args = { request: Request; params: Record<string, string | readonly string[] | undefined> };
  const admin = (fn: (args: Args) => Response | Promise<Response>) => (args: Args) => guard(args.request) ?? fn(args);

  return [
    http.get(
      '*/api/admin/stats',
      admin(() =>
        HttpResponse.json({
          todayNewPostCount: 312,
          failingSourceCount: adminState.sources.filter((s) => s.status === 'ERROR').length,
          activeSourceCount: adminState.sources.filter((s) => s.status === 'ACTIVE').length,
        }),
      ),
    ),
    http.get(
      '*/api/admin/sources',
      admin(({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        const items = adminState.sources.filter((s) => !status || s.status === status);
        return HttpResponse.json({ items });
      }),
    ),
    http.post(
      '*/api/admin/sources/validate',
      admin(async ({ request }) => {
        const { feedUrl } = (await request.json()) as { feedUrl: string };
        return HttpResponse.json(feedCheck(feedUrl));
      }),
    ),
    http.post(
      '*/api/admin/sources',
      admin(async ({ request }) => {
        const input = (await request.json()) as SourceInput;
        const check = feedCheck(input.feedUrl);
        if (!check.valid) return err(422, 'SOURCE_FEED_INVALID', `유효한 피드가 아님: ${check.reason}`);
        if (check.duplicated) return err(409, 'SOURCE_FEED_DUPLICATED', '같은 피드 URL 소스가 이미 있음');
        const now = new Date().toISOString();
        const source: AdminSource = {
          id: adminState.nextId++,
          ...input,
          status: 'ACTIVE',
          lastSuccessAt: null,
          newPostCount7d: 0,
          consecutiveFailures: 0,
          nextCrawlAt: now,
          lastCrawledAt: null,
          createdAt: now,
          updatedAt: now,
        };
        adminState.sources.push(source);
        adminState.runs.set(source.id, []);
        return HttpResponse.json(source, { status: 201 });
      }),
    ),
    http.get(
      '*/api/admin/sources/:id',
      admin(({ params }) => {
        const source = findSource(params.id);
        return source ? HttpResponse.json(source) : err(404, 'NOT_FOUND', '소스를 찾을 수 없음');
      }),
    ),
    http.patch(
      '*/api/admin/sources/:id',
      admin(async ({ request, params }) => {
        const source = findSource(params.id);
        if (!source) return err(404, 'NOT_FOUND', '소스를 찾을 수 없음');
        const input = (await request.json()) as UpdateSourceInput;
        if (input.feedUrl && input.feedUrl !== source.feedUrl) {
          const check = feedCheck(input.feedUrl, source.id);
          if (!check.valid) return err(422, 'SOURCE_FEED_INVALID', `유효한 피드가 아님: ${check.reason}`);
          if (check.duplicated) return err(409, 'SOURCE_FEED_DUPLICATED', '같은 피드 URL 소스가 이미 있음');
        }
        Object.assign(source, input, { updatedAt: new Date().toISOString() });
        return HttpResponse.json(source);
      }),
    ),
    http.get(
      '*/api/admin/sources/:id/runs',
      admin(({ params }) => {
        if (!findSource(params.id)) return err(404, 'NOT_FOUND', '소스를 찾을 수 없음');
        return HttpResponse.json({ items: settleRuns(adminState.runs.get(Number(params.id)) ?? []).slice(0, 50) });
      }),
    ),
    http.post(
      '*/api/admin/sources/:id/crawl',
      admin(({ params }) => {
        const source = findSource(params.id);
        if (!source) return err(404, 'NOT_FOUND', '소스를 찾을 수 없음');
        if (source.status === 'INACTIVE') return err(409, 'SOURCE_INACTIVE', '비활성 소스는 수집할 수 없음');
        const runs = settleRuns(adminState.runs.get(source.id) ?? []);
        if (runs.some((r) => r.result === 'RUNNING')) return err(409, 'CRAWL_ALREADY_RUNNING', '이미 수집 중임');
        const run: CrawlRun = {
          id: adminState.nextId++,
          triggerType: 'MANUAL',
          result: 'RUNNING',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          durationMs: null,
          attemptCount: 1,
          httpStatus: null,
          fetchedCount: 0,
          newPostCount: 0,
          updatedPostCount: 0,
          errorMessage: null,
        };
        adminState.runs.set(source.id, [run, ...runs]);
        return HttpResponse.json({ crawlRunId: run.id }, { status: 202 });
      }),
    ),
    http.post(
      '*/api/admin/sources/:id/resume',
      admin(({ params }) => {
        const source = findSource(params.id);
        if (!source) return err(404, 'NOT_FOUND', '소스를 찾을 수 없음');
        if (source.status !== 'ERROR') return err(409, 'SOURCE_NOT_IN_ERROR', '오류 상태가 아님');
        Object.assign(source, { status: 'ACTIVE', consecutiveFailures: 0, nextCrawlAt: new Date().toISOString() });
        return HttpResponse.json(source);
      }),
    ),
    http.get(
      '*/api/admin/tags',
      admin(({ request }) => {
        const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? '';
        const items = adminState.tags.filter(
          (t) => !q || t.name.toLowerCase().includes(q) || t.synonyms.some((s) => s.toLowerCase().includes(q)),
        );
        return HttpResponse.json({ items });
      }),
    ),
    http.post(
      '*/api/admin/tags/retag',
      admin(() => {
        if (progressJob()?.status === 'RUNNING') return err(409, 'JOB_ALREADY_RUNNING', '재태깅이 이미 실행 중임');
        adminState.job = {
          id: crypto.randomUUID(),
          type: 'RETAG',
          status: 'RUNNING',
          processed: 0,
          total: 1000,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          errorMessage: null,
        };
        return HttpResponse.json({ jobId: adminState.job.id }, { status: 202 });
      }),
    ),
    http.post(
      '*/api/admin/tags',
      admin(async ({ request }) => {
        const input = (await request.json()) as TagInput;
        const conflict = tagConflict(input);
        if (conflict) return conflict;
        const tag: AdminTag = { id: adminState.nextId++, ...input, synonyms: input.synonyms ?? [], postCount: 0 };
        adminState.tags.push(tag);
        return HttpResponse.json(tag, { status: 201 });
      }),
    ),
    http.patch(
      '*/api/admin/tags/:id',
      admin(async ({ request, params }) => {
        const tag = adminState.tags.find((t) => t.id === Number(params.id));
        if (!tag) return err(404, 'NOT_FOUND', '태그를 찾을 수 없음');
        const input = (await request.json()) as Partial<TagInput>;
        const conflict = tagConflict(input, tag.id);
        if (conflict) return conflict;
        Object.assign(tag, input);
        return HttpResponse.json(tag);
      }),
    ),
    http.get(
      '*/api/admin/jobs/:jobId',
      admin(({ params }) =>
        adminState.job?.id === params.jobId ? HttpResponse.json(progressJob()) : err(404, 'NOT_FOUND', '작업을 찾을 수 없음'),
      ),
    ),
  ];
}
