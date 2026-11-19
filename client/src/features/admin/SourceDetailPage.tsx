import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@onyx/components/button/button';
import { crawlSource, resumeSource, updateSource } from '@/api/admin';
import { ApiError } from '@/api/http';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FullPageSpinner } from '@/components/common/FullPageSpinner';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatDuration } from '@/lib/format';
import { ADMIN_KEY, adminSourceQuery, crawlRunsQuery } from './queries';
import { RunResultBadge, SourceStatusBadge } from './StatusBadge';

export function SourceDetailPage() {
  const id = Number(useParams().id);
  const client = useQueryClient();
  const source = useQuery({ ...adminSourceQuery(id), enabled: Number.isInteger(id) && id > 0 });
  const runs = useQuery({ ...crawlRunsQuery(id), enabled: Number.isInteger(id) && id > 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const running = runs.data?.some((r) => r.result === 'RUNNING') ?? false;
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) client.invalidateQueries({ queryKey: ADMIN_KEY });
    wasRunning.current = running;
  }, [running, client]);

  const refreshAll = () => client.invalidateQueries({ queryKey: ADMIN_KEY });
  const onError = (e: unknown) => setNotice({ tone: 'error', text: errorMessage(e) });

  const crawl = useMutation({
    mutationFn: () => crawlSource(id),
    onSuccess: () => {
      setNotice({ tone: 'ok', text: '수집을 시작했음' });
      refreshAll();
    },
    onError,
  });
  const resume = useMutation({
    mutationFn: () => resumeSource(id),
    onSuccess: () => {
      setNotice({ tone: 'ok', text: '수집을 재개했음' });
      refreshAll();
    },
    onError,
  });
  const toggleActive = useMutation({
    mutationFn: (next: 'ACTIVE' | 'INACTIVE') => updateSource(id, { status: next }),
    onSuccess: (_d, next) => {
      setConfirmOpen(false);
      setNotice({ tone: 'ok', text: next === 'INACTIVE' ? '비활성화했음' : '다시 활성화했음' });
      refreshAll();
    },
    onError: (e) => {
      setConfirmOpen(false);
      onError(e);
    },
  });

  if (source.isPending) return <FullPageSpinner />;
  if (source.isError) {
    return source.error instanceof ApiError && source.error.code === 'NOT_FOUND' ? (
      <EmptyState title="소스를 찾을 수 없음" action={<Link to="/admin" className="text-sm text-brand">목록으로</Link>} />
    ) : (
      <ErrorState message={source.error.message} onRetry={() => source.refetch()} />
    );
  }

  const s = source.data;
  const inactive = s.status === 'INACTIVE';

  return (
    <section>
      <Link to="/admin" className="text-sm text-fg-secondary hover:text-brand">
        ← 수집 현황
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{s.name}</h1>
        <SourceStatusBadge status={s.status} />
        <div className="ml-auto flex flex-wrap gap-2">
          {s.status === 'ERROR' && (
            <Button width={72} height={34} variant="outlined" content="재개" disabled={resume.isPending} onClick={() => resume.mutate()} />
          )}
          <Button
            width={88}
            height={34}
            className="bg-brand text-white"
            content={running ? '수집 중' : '지금 수집'}
            disabled={inactive || running || crawl.isPending}
            onClick={() => crawl.mutate()}
          />
          <Link
            to={`/admin/sources/${id}/edit`}
            className="flex h-[34px] items-center rounded-[var(--radius-sm)] border border-line px-3 text-xs"
          >
            수정
          </Link>
          <Button
            width={88}
            height={34}
            variant="outlined"
            content={inactive ? '활성화' : '비활성화'}
            onClick={() => setConfirmOpen(true)}
          />
        </div>
      </div>

      {notice && (
        <p role="status" className={notice.tone === 'ok' ? 'mt-3 text-sm text-emerald-700' : 'mt-3 text-sm text-red-600'}>
          {notice.text}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-[var(--radius-md)] border border-line bg-surface p-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-fg-secondary">피드 URL</dt>
          <dd className="truncate">{s.feedUrl}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-fg-secondary">블로그 URL</dt>
          <dd className="truncate">{s.siteUrl}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-secondary">유형 · 주기</dt>
          <dd>
            {s.type === 'COMPANY' ? '기업' : '개인'} · {s.crawlIntervalMin}분
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-secondary">다음 수집 · 연속 실패</dt>
          <dd>
            {inactive ? '-' : formatDateTime(s.nextCrawlAt)} · {s.consecutiveFailures}회
          </dd>
        </div>
      </dl>

      <h2 className="mb-2 mt-6 text-base font-semibold">최근 수집 이력</h2>
      {runs.isPending ? (
        <FullPageSpinner />
      ) : runs.isError ? (
        <ErrorState message={runs.error.message} onRetry={() => runs.refetch()} />
      ) : runs.data.length === 0 ? (
        <EmptyState title="수집 이력이 없음" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-fg-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">시작</th>
                <th className="px-3 py-2 font-medium">구분</th>
                <th className="px-3 py-2 font-medium">소요</th>
                <th className="px-3 py-2 font-medium">결과</th>
                <th className="px-3 py-2 text-right font-medium">신규</th>
                <th className="px-3 py-2 font-medium">오류</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDateTime(r.startedAt)}</td>
                  <td className="px-3 py-2 text-fg-secondary">{r.triggerType === 'MANUAL' ? '수동' : '자동'}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDuration(r.durationMs)}</td>
                  <td className="px-3 py-2">
                    <RunResultBadge result={r.result} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.newPostCount}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-red-600" title={r.errorMessage ?? undefined}>
                    {r.errorMessage ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={inactive ? '소스 활성화' : '소스 비활성화'}
        confirmLabel={inactive ? '활성화' : '비활성화'}
        danger={!inactive}
        pending={toggleActive.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => toggleActive.mutate(inactive ? 'ACTIVE' : 'INACTIVE')}
      >
        {inactive
          ? '주기 수집 대상에 다시 포함함.'
          : '수집 대상에서 빠짐. 이미 수집한 글은 피드에 그대로 남음.'}
      </ConfirmModal>
    </section>
  );
}
