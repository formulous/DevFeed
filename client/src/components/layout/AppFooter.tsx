import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('w-full border-t border-line', className)}>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-5 text-xs text-fg-muted">
        <span>DevFeed · 기술 블로그 글의 요약과 원문 링크만 제공함</span>
        <Link to="/privacy" className="ml-auto font-medium text-fg-secondary hover:text-brand">
          개인정보 안내
        </Link>
      </div>
    </footer>
  );
}
