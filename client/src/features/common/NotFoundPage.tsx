import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="페이지를 찾을 수 없음"
      action={
        <Link to="/" className="text-sm font-medium text-brand">
          홈으로
        </Link>
      }
    />
  );
}
