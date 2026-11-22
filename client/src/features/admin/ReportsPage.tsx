import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { fetchReports, resolveReport } from '@/api/community';
import type { ReportTarget } from '@/api/types';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/components/common/Toast';
import { POSTS_KEY } from '@/hooks/usePostActions';
import { cn } from '@/lib/cn';
import { REPORT_REASONS } from '@/lib/community';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { communityPostPath } from '@/lib/routes';
import { ADMIN_KEY } from './queries';

type Tab = 'PENDING' | 'HIDDEN';

const TABS: { value: Tab; label: string }[] = [
  { value: 'PENDING', label: '대기' },
  { value: 'HIDDEN', label: '숨김' },
];

const BTN = 'h-8 whitespace-nowrap rounded-full border px-3 text-xs font-medium disabled:opacity-50';

function stateLabel(r: ReportTarget) {
  if (r.state === 'HIDDEN') return r.preview.hiddenReason === 'REPORTS' ? '자동 숨김' : '관리자 숨김';
  return r.preview.status === 'HIDDEN' ? '숨김' : '보임';
}

function targetLink(r: ReportTarget) {
  return r.targetType === 'POST' ? communityPostPath(r.postId) : null;
}

function Row({ r, onResolve, pending }: { r: ReportTarget; onResolve: (action: 'HIDE' | 'CLEAR') => void; pending: boolean }) {
  const link = targetLink(r);
  const reasons = REPORT_REASONS.filter((x) => r.reasons[x.value] > 0);
  return (
    <li className="grid gap-2 py-3 text-sm md:grid-cols-[96px_minmax(0,1fr)_160px_88px_auto] md:items-start md:gap-4">
      <div className="font-medium">
        {r.targetType === 'POST' ? '글' : '댓글'} #{r.targetId}
        <span className="block text-xs font-normal text-fg-muted">{formatDateTime(r.lastReportedAt)}</span>
      </div>
      <div className="min-w-0">
        {r.preview.title && <p className="truncate font-medium">{r.preview.title}</p>}
        <p className="line-clamp-2 break-words text-fg-secondary">{r.preview.text}</p>
        <p className="mt-0.5 text-xs text-fg-muted">
          {r.preview.author?.nickname ?? '탈퇴한 회원'}
          {link ? (
            <>
              {' · '}
              <Link to={link} className="text-brand hover:underline">
                글 보기
              </Link>
            </>
          ) : (
            <> · 글 #{r.postId}</>
          )}
        </p>
        {r.details && r.details.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs text-fg-secondary">
            {r.details.map((d, i) => (
              <li key={i} className="break-words">
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ul className="flex flex-wrap gap-1 text-xs md:flex-col" aria-label="사유별 신고 수">
        {reasons.map((x) => (
          <li key={x.value}>
            {x.label} <span className="font-semibold tabular-nums">{r.reasons[x.value]}</span>
          </li>
        ))}
      </ul>
      <span
        className={cn(
          'w-fit rounded-full px-2 py-0.5 text-xs font-medium',
          r.state === 'HIDDEN' || r.preview.status === 'HIDDEN' ? 'bg-danger-soft text-danger' : 'bg-subtle text-fg-secondary',
        )}
      >
        {stateLabel(r)}
      </span>
      <div className="flex gap-1.5 md:justify-end">
        {r.state === 'PENDING' && (
          <button type="button" disabled={pending} onClick={() => onResolve('HIDE')} className={cn(BTN, 'border-danger-line text-danger')}>
            숨김
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => onResolve('CLEAR')} className={cn(BTN, 'border-line text-fg-secondary hover:text-fg')}>
          {r.state === 'HIDDEN' ? '숨김 해제' : '문제없음'}
        </button>
      </div>
    </li>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('PENDING');
  const client = useQueryClient();
  const toast = useToast();
  const key = [...ADMIN_KEY, 'reports', tab];
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => fetchReports(tab, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const resolve = useMutation({
    mutationFn: ({ r, action }: { r: ReportTarget; action: 'HIDE' | 'CLEAR' }) => resolveReport(r.targetType, r.targetId, action),
    onSuccess: (res) => {
      toast(res.state === 'CLEARED' ? '문제없음으로 처리했어요' : '숨겼어요');
      client.invalidateQueries({ queryKey: [...ADMIN_KEY, 'reports'] });
      client.invalidateQueries({ queryKey: POSTS_KEY });
      client.invalidateQueries({ queryKey: ['comments'] });
    },
    onError: (error) => toast(errorMessage(error, '처리하지 못했어요'), 'error'),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">신고 관리</h1>
        <div role="tablist" aria-label="신고 상태" className="inline-flex rounded-lg bg-subtle p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'h-7 rounded-md px-3.5 text-[13px]',
                tab === t.value ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-inset ring-line-strong' : 'text-fg-secondary hover:text-fg',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-fg-muted">
        서로 다른 3명이 신고하면 자동으로 숨겨져요. 문제없음으로 처리하면 다시 보이고 이후 자동 숨김에서 빠져요.
      </p>
      <div className="rounded-[var(--radius-md)] border border-line bg-surface px-4">
        {list.isPending ? (
          <p className="py-6 text-sm text-fg-muted">불러오는 중이에요</p>
        ) : list.isError ? (
          <div className="py-4">
            <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-4">
            <EmptyState title={tab === 'PENDING' ? '처리할 신고가 없어요' : '숨긴 대상이 없어요'} />
          </div>
        ) : (
          <ul className="divide-y divide-line" aria-label="신고 목록">
            {items.map((r) => (
              <Row
                key={`${r.targetType}:${r.targetId}`}
                r={r}
                pending={resolve.isPending}
                onResolve={(action) => resolve.mutate({ r, action })}
              />
            ))}
          </ul>
        )}
      </div>
      {list.hasNextPage && (
        <button
          type="button"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
          className="mt-3 w-full rounded-full border border-line py-1.5 text-sm text-fg-secondary hover:bg-subtle"
        >
          더보기
        </button>
      )}
    </section>
  );
}
