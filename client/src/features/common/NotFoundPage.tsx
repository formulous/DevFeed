import { HOME } from '@/lib/routes';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="페이지를 찾을 수 없어요"
      action={
        <Link to={HOME} className="text-sm font-medium text-brand">
          홈으로
        </Link>
      }
    />
  );
}
