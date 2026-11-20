import { categoryLabel } from '@/lib/categories';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@onyx/components/button/button';
import { fetchJob, startRetag } from '@/api/admin';
import type { AdminTag } from '@/api/types';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FullPageSpinner } from '@/components/common/FullPageSpinner';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { errorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { ADMIN_KEY, JOB_POLL_MS, adminTagsQuery } from './queries';
import { TagFormModal } from './TagFormModal';

function RetagProgress({ jobId }: { jobId: string }) {
  const job = useQuery({
    queryKey: [...ADMIN_KEY, 'job', jobId],
    queryFn: () => fetchJob(jobId),
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'RUNNING' ? false : JOB_POLL_MS),
  });
  if (!job.data) return <p className="text-sm text-fg-secondary">재태깅 작업 상태 확인 중</p>;
  const { status, processed, total, errorMessage: jobError } = job.data;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-surface p-3 text-sm">
      <div className="flex justify-between">
        <span>
          {status === 'RUNNING' ? '재태깅 진행 중' : status === 'SUCCEEDED' ? '재태깅 완료' : '재태깅 실패'}
        </span>
        <span className="tabular-nums text-fg-secondary">
          {formatNumber(processed)} / {formatNumber(total)} ({pct}%)
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="재태깅 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-2 overflow-hidden rounded-full bg-subtle"
      >
        <div
          className={status === 'FAILED' ? 'h-full bg-danger' : 'h-full bg-inverse transition-[width]'}
          style={{ width: `${pct}%` }}
        />
      </div>
      {jobError && <p className="mt-2 text-danger">{jobError}</p>}
    </div>
  );
}

export function TagDictionaryPage() {
  const client = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const q = useDebouncedValue(keyword.trim(), 300);
  const tags = useQuery(adminTagsQuery(q));
  const [editing, setEditing] = useState<AdminTag | null | undefined>(undefined);
  const [confirmRetag, setConfirmRetag] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const retag = useMutation({
    mutationFn: startRetag,
    onSuccess: ({ jobId: id }) => {
      setConfirmRetag(false);
      setJobId(id);
    },
    onError: () => setConfirmRetag(false),
  });

  const onSaved = () => {
    setEditing(undefined);
    client.invalidateQueries({ queryKey: [...ADMIN_KEY, 'tags'] });
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">태그 사전</h1>
        <div className="ml-auto flex gap-2">
          <Button width={88} height={34} className="rounded-full bg-inverse text-on-inverse" content="+ 태그 추가" onClick={() => setEditing(null)} />
          <Button width={120} height={34} variant="outlined" content="전체 재태깅 실행" onClick={() => setConfirmRetag(true)} />
        </div>
      </div>

      <div className="mb-3 space-y-2">
        {retag.isError && <p className="text-sm text-danger">{errorMessage(retag.error)}</p>}
        {jobId && <RetagProgress jobId={jobId} />}
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        maxLength={30}
        placeholder="태그명·동의어 검색"
        aria-label="태그 검색"
        className="mb-3 h-9 w-full max-w-sm rounded-lg border border-line px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-focus"
      />

      {tags.isPending ? (
        <FullPageSpinner />
      ) : tags.isError ? (
        <ErrorState message={tags.error.message} onRetry={() => tags.refetch()} />
      ) : tags.data.length === 0 ? (
        <EmptyState title="태그가 없어요" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-hover text-left text-xs text-fg-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">태그</th>
                <th className="px-3 py-2 font-medium">분류</th>
                <th className="px-3 py-2 font-medium">동의어</th>
                <th className="px-3 py-2 text-right font-medium">사용 글 수</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tags.data.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-1 text-xs text-fg-muted">{t.slug}</span>
                  </td>
                  <td className="px-3 py-2 text-fg-secondary">{t.category ? categoryLabel(t.category) : '-'}</td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-fg-secondary" title={t.synonyms.join(', ')}>
                    {t.synonyms.join(', ') || '-'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(t.postCount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="text-xs text-brand"
                      aria-label={`${t.name} 수정`}
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TagFormModal tag={editing ?? null} open={editing !== undefined} onClose={() => setEditing(undefined)} onSaved={onSaved} />
      <ConfirmModal
        open={confirmRetag}
        title="전체 재태깅"
        confirmLabel="실행"
        pending={retag.isPending}
        onClose={() => setConfirmRetag(false)}
        onConfirm={() => retag.mutate()}
      >
        현재 태그 사전으로 모든 글의 태그를 다시 계산해요. 글 수에 따라 몇 분 걸릴 수 있어요. 실행할까요?
      </ConfirmModal>
    </section>
  );
}
