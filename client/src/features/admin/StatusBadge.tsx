import type { CrawlResult, SourceStatus } from '@/api/types';
import { cn } from '@/lib/cn';

const SOURCE: Record<SourceStatus, { label: string; className: string }> = {
  ACTIVE: { label: '정상', className: 'bg-emerald-50 text-emerald-700' },
  ERROR: { label: '오류', className: 'bg-red-50 text-red-700' },
  INACTIVE: { label: '비활성', className: 'bg-slate-100 text-slate-600' },
};

const RUN: Record<CrawlResult, { label: string; className: string }> = {
  RUNNING: { label: '진행 중', className: 'bg-blue-50 text-blue-700' },
  SUCCESS: { label: '성공', className: 'bg-emerald-50 text-emerald-700' },
  NOT_MODIFIED: { label: '변경 없음', className: 'bg-slate-100 text-slate-600' },
  FAILURE: { label: '실패', className: 'bg-red-50 text-red-700' },
};

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', className)}>{label}</span>;
}

export const SourceStatusBadge = ({ status }: { status: SourceStatus }) => <Badge {...SOURCE[status]} />;
export const RunResultBadge = ({ result }: { result: CrawlResult }) => <Badge {...RUN[result]} />;
export const SOURCE_STATUS_LABEL = Object.fromEntries(Object.entries(SOURCE).map(([k, v]) => [k, v.label])) as Record<
  SourceStatus,
  string
>;
