import { useState, type ReactNode } from 'react';
import { FiInfo } from 'react-icons/fi';
import { Link, useLocation } from 'react-router';
import type { Profile } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/cn';
import { compactNumber, formatNumber } from '@/lib/format';
import { gradeByLevel, gradeProgress } from '@/lib/grades';
import { Avatar } from './Avatar';
import { GradeBadge } from './GradeBadge';
import { GradeGuideModal } from './GradeGuideModal';

const WRAP = 'mb-4 border-b border-line pb-4 last:mb-0 last:border-b-0 last:pb-0';

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <>
      <span className="block text-sm font-semibold tabular-nums text-fg">{compactNumber(value)}</span>
      <span className="block whitespace-nowrap text-[11px] text-fg-muted">{label}</span>
    </>
  );
  const cls = 'block rounded-md px-0.5 py-0.5 text-center';
  return (
    <li>
      {to ? (
        <Link to={to} aria-label={`${label} ${formatNumber(value)}개 보기`} className={cn(cls, 'hover:bg-hover')}>
          {body}
        </Link>
      ) : (
        <span className={cls}>{body}</span>
      )}
    </li>
  );
}

function MemberCard({ profile }: { profile: Profile }) {
  const [guide, setGuide] = useState(false);
  const { score, grade, stats } = profile;
  const next = grade.nextMinScore;
  const nextName = gradeByLevel(grade.level + 1)?.name;
  const ratio = gradeProgress(score, grade.minScore, next);
  const percent = Math.round(ratio * 100);

  return (
    <section aria-label="내 프로필" data-testid="profile-card" className={WRAP}>
      <div className="flex items-center gap-3">
        <Avatar nickname={profile.nickname} />
        <div className="min-w-0 flex-1">
          <Link to="/me/settings" className="block truncate text-sm font-semibold text-fg hover:underline">
            {profile.nickname}
          </Link>
          <div className="mt-0.5 flex items-center gap-1">
            <GradeBadge grade={grade} />
            <button
              type="button"
              aria-label="등급 안내"
              onClick={() => setGuide(true)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-fg-muted hover:text-fg"
            >
              <FiInfo size={13} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div
          role="progressbar"
          aria-label={next === null ? '최고 등급' : nextName ? `${nextName}까지 진행률` : '다음 등급까지 진행률'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 overflow-hidden rounded-full bg-subtle-strong"
        >
          <div className="h-full rounded-full bg-inverse transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-fg-muted">
          <span>{next === null ? '최고 등급이에요' : `다음 등급까지 ${formatNumber(Math.max(0, next - score))}P`}</span>
          <span className="tabular-nums">
            {formatNumber(score)}
            {next !== null && ` / ${formatNumber(next)}`}P
          </span>
        </div>
      </div>
      <ul className="mt-2.5 grid grid-cols-5 gap-0.5" aria-label="활동 수치">
        <Stat label="글" value={stats.posts ?? 0} />
        <Stat label="좋아요" value={stats.likes} />
        <Stat label="댓글" value={stats.comments} />
        <Stat label="읽은 글" value={stats.reads} to="/me/history" />
        <Stat label="북마크" value={stats.bookmarks} to="/me/bookmarks" />
      </ul>
      <GradeGuideModal open={guide} onClose={() => setGuide(false)} />
    </section>
  );
}

function GuestCard() {
  const location = useLocation();
  const redirect = encodeURIComponent(location.pathname + location.search);
  return (
    <section aria-label="로그인 안내" data-testid="guest-card" className={WRAP}>
      <p className="text-sm font-semibold text-fg">formulous에 로그인하고</p>
      <p className="mt-0.5 text-sm text-fg-secondary">좋아요·댓글로 등급을 올려 보세요</p>
      <div className="mt-3 flex gap-2">
        <Link
          to={`/login?redirect=${redirect}`}
          className="flex h-8 items-center rounded-full bg-inverse px-3.5 text-sm font-medium text-on-inverse hover:opacity-90"
        >
          로그인
        </Link>
        <Link
          to={`/signup?redirect=${redirect}`}
          className="flex h-8 items-center rounded-full border border-line px-3.5 text-sm font-medium text-fg-secondary hover:border-line-strong hover:text-fg"
        >
          회원가입
        </Link>
      </div>
    </section>
  );
}

function CardSkeleton() {
  return (
    <div aria-hidden data-testid="profile-skeleton" className={cn(WRAP, 'animate-pulse')}>
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-subtle" />
        <div className="flex-1 space-y-2">
          <span className="block h-3 w-24 rounded bg-subtle" />
          <span className="block h-3 w-16 rounded bg-subtle" />
        </div>
      </div>
      <span className="mt-4 block h-1.5 rounded-full bg-subtle" />
      <span className="mt-5 block h-8 rounded bg-subtle" />
    </div>
  );
}

export function ProfileCard() {
  const { status } = useAuth();
  const profile = useProfile();
  if (status === 'guest') return <GuestCard />;
  if (status === 'loading' || profile.isPending) return <CardSkeleton />;
  if (profile.isError) {
    return (
      <div className={cn(WRAP, 'text-xs text-fg-muted')}>
        프로필을 불러오지 못했어요.{' '}
        <button type="button" className="font-medium text-fg-secondary hover:text-fg" onClick={() => profile.refetch()}>
          다시 시도
        </button>
      </div>
    );
  }
  return <MemberCard profile={profile.data} />;
}

export function ProfileRail({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        aria-label="프로필"
        className="hidden lg:sticky lg:top-[calc(var(--header-h,6.5rem)+1.5rem)] lg:block lg:w-64 lg:shrink-0"
      >
        <ProfileCard />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
