import { JobRegistry } from './job-registry';

describe('JobRegistry', () => {
  it('진행 상황을 기록하고 성공 처리함', async () => {
    const jobs = new JobRegistry();
    const { job, done } = jobs.start('RETAG', async (ctx) => {
      ctx.setTotal(10);
      ctx.advance(4);
      ctx.advance(6);
    });
    await done;
    expect(jobs.get(job.id)).toMatchObject({ status: 'SUCCEEDED', processed: 10, total: 10 });
    expect(jobs.get(job.id)?.finishedAt).toBeInstanceOf(Date);
  });

  it('같은 종류 작업이 실행 중이면 JOB_ALREADY_RUNNING', async () => {
    const jobs = new JobRegistry();
    let release!: () => void;
    const { done } = jobs.start('RETAG', () => new Promise<void>((resolve) => (release = resolve)));
    expect(() => jobs.start('RETAG', async () => undefined)).toThrow(
      expect.objectContaining({ code: 'JOB_ALREADY_RUNNING' }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    release();
    await done;
  });

  it('실패하면 FAILED와 오류 메시지를 남김', async () => {
    const jobs = new JobRegistry();
    const { job, done } = jobs.start('RETAG', async () => {
      throw new Error('boom');
    });
    await done;
    expect(jobs.get(job.id)).toMatchObject({ status: 'FAILED', errorMessage: 'boom' });
  });
});
