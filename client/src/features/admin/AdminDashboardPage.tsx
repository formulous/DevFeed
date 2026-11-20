import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { AdminSourceListItem, SourceKind, SourceStatus } from '@/api/types';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FullPageSpinner } from '@/components/common/FullPageSpinner';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { relativeTime } from '@/lib/time';
import { adminSourcesQuery, adminStatsQuery } from './queries';
import { SourceStatusBadge } from './StatusBadge';
import { M7_API_READY } from '@/lib/features';
import { KIND_LABEL, parseKind, sourceKindLabel } from './sourceKind';

const FILTERS: { value: SourceStatus | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'ACTIVE', label: '정상' },
  { value: 'ERROR', label: '오류' },
  { value: 'INACTIVE', label: '비활성' },
];

const KIND_FILTERS: { value: SourceKind | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'BLOG', label: KIND_LABEL.BLOG },
  { value: 'SECURITY_NEWS', label: KIND_LABEL.SECURITY_NEWS },
];

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T | null; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs font-medium text-fg-muted" aria-hidden>
        {label.replace(' 필터', '')}
      </span>
      {options.map((f) => (
        <button
          key={f.label}
          type="button"
          role="radio"
          aria-checked={value === f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            'rounded-full px-3 py-1 text-sm',
            value === f.value ? 'bg-inverse text-on-inverse' : 'bg-surface text-fg-secondary hover:bg-subtle',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function parseStatus(value: string | null): SourceStatus | null {
  return value === 'ACTIVE' || value === 'ERROR' || value === 'INACTIVE' ? value : null;
}

function StatTile({ label, value, tone }: { label: string; value?: number; tone?: 'danger' }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
      <p className="text-xs text-fg-secondary">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone === 'danger' && value ? 'text-danger' : '')}>
        {value === undefined ? '-' : formatNumber(value)}
      </p>
    </div>
  );
}

const lastSuccess = (s: AdminSourceListItem) => (s.lastSuccessAt ? relativeTime(s.lastSuccessAt) : '없음');

export function AdminDashboardPage() {
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get('status'));
  const kind = M7_API_READY ? parseKind(params.get('kind')) : null;
  const navigate = useNavigate();
  const stats = useQuery(adminStatsQuery);
  const sources = useQuery(adminSourcesQuery(status, kind));

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">수집 현황</h1>
        <Link to="/admin/sources/new" className="rounded-full bg-inverse px-3.5 py-2 text-sm font-medium text-on-inverse">
          + 소스 추가
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="오늘 수집 글" value={stats.data?.todayNewPostCount} />
        <StatTile label="실패 중 소스" value={stats.data?.failingSourceCount} tone="danger" />
        <StatTile label="활성 소스" value={stats.data?.activeSourceCount} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterGroup label="상태 필터" options={FILTERS} value={status} onChange={(v) => setParam('status', v)} />
        {M7_API_READY && <FilterGroup label="종류 필터" options={KIND_FILTERS} value={kind} onChange={(v) => setParam('kind', v)} />}
      </div>

      {sources.isPending ? (
        <FullPageSpinner />
      ) : sources.isError ? (
        <ErrorState message={sources.error.message} onRetry={() => sources.refetch()} />
      ) : sources.data.length === 0 ? (
        <EmptyState title="조건에 맞는 소스가 없어요" />
      ) : (
        <>
          <table className="hidden w-full overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface text-sm md:table">
            <thead className="bg-hover text-left text-xs text-fg-secondary">
              <tr>
                <th className="px-4 py-2 font-medium">소스</th>
                <th className="px-4 py-2 font-medium">종류</th>
                <th className="px-4 py-2 font-medium">상태</th>
                <th className="px-4 py-2 font-medium">마지막 성공</th>
                <th className="px-4 py-2 text-right font-medium">7일 신규</th>
                <th className="px-4 py-2 text-right font-medium">연속 실패</th>
              </tr>
            </thead>
            <tbody>
              {sources.data.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/admin/sources/${s.id}`)}
                  className="cursor-pointer border-t border-line hover:bg-hover"
                >
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/sources/${s.id}`} className="font-medium hover:text-brand" onClick={(e) => e.stopPropagation()}>
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-fg-secondary">{sourceKindLabel(s)}</td>
                  <td className="px-4 py-2.5">
                    <SourceStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-2.5 text-fg-secondary">{lastSuccess(s)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.newPostCount7d}</td>
                  <td className={cn('px-4 py-2.5 text-right tabular-nums', s.consecutiveFailures > 0 && 'text-danger')}>
                    {s.consecutiveFailures}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="space-y-2 md:hidden">
            {sources.data.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/admin/sources/${s.id}`}
                  className="block rounded-[var(--radius-md)] border border-line bg-surface p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    <SourceStatusBadge status={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-fg-secondary">
                    {sourceKindLabel(s)} · 마지막 성공 {lastSuccess(s)} · 7일 신규 {s.newPostCount7d} · 연속 실패 {s.consecutiveFailures}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
