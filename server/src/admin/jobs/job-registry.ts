import { randomUUID } from 'node:crypto';
import { Errors } from '../../common/errors/app.exception';

export type JobType = 'RETAG';
export type JobStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  processed: number;
  total: number;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
}

export interface JobContext {
  setTotal(total: number): void;
  advance(count: number): void;
}

const MAX_KEPT_JOBS = 50;

export class JobRegistry {
  private readonly jobs = new Map<string, Job>();

  constructor(private readonly onFailure: (job: Job, error: Error) => void = () => undefined) {}

  start(type: JobType, work: (context: JobContext) => Promise<void>): { job: Job; done: Promise<void> } {
    const running = [...this.jobs.values()].some((j) => j.type === type && j.status === 'RUNNING');
    if (running) throw Errors.jobAlreadyRunning();

    const job: Job = {
      id: randomUUID(),
      type,
      status: 'RUNNING',
      processed: 0,
      total: 0,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
    };
    this.jobs.set(job.id, job);
    this.prune();

    const done = Promise.resolve()
      .then(() =>
        work({
          setTotal: (total) => (job.total = total),
          advance: (count) => (job.processed += count),
        }),
      )
      .then(() => {
        job.status = 'SUCCEEDED';
      })
      .catch((error: Error) => {
        job.status = 'FAILED';
        job.errorMessage = (error?.message ?? String(error)).slice(0, 500);
        this.onFailure(job, error);
      })
      .finally(() => {
        job.finishedAt = new Date();
      });
    return { job, done };
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  private prune(): void {
    const finished = [...this.jobs.values()].filter((j) => j.status !== 'RUNNING');
    const excess = this.jobs.size - MAX_KEPT_JOBS;
    for (const job of finished.slice(0, Math.max(0, excess))) this.jobs.delete(job.id);
  }
}
