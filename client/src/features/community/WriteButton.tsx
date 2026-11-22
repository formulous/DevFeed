import { FiEdit3 } from 'react-icons/fi';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { useLoginPrompt } from '@/auth/LoginPromptProvider';
import { parseCategory } from '@/lib/community';
import { PATHS } from '@/lib/routes';

const CLS =
  'flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-inverse px-3.5 text-[13px] font-medium text-on-inverse hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring';

export function WriteButton({ className }: { className?: string }) {
  const { status } = useAuth();
  const { openLoginPrompt } = useLoginPrompt();
  const [params] = useSearchParams();
  const category = parseCategory(params.get('category'));
  const body = (
    <>
      <FiEdit3 size={14} aria-hidden />
      글쓰기
    </>
  );
  if (status !== 'member') {
    return (
      <button
        type="button"
        className={`${CLS} ${className ?? ''}`}
        disabled={status === 'loading'}
        onClick={() => openLoginPrompt('글을 쓰려면 로그인이 필요해요')}
      >
        {body}
      </button>
    );
  }
  return (
    <Link to={category ? `${PATHS.communityNew}?category=${category.key}` : PATHS.communityNew} className={`${CLS} ${className ?? ''}`}>
      {body}
    </Link>
  );
}
