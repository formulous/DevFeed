import { Button } from '@onyx/components/button/button';
import { EmptyState } from './EmptyState';

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <EmptyState
      title="글을 불러오지 못했음"
      description={message}
      action={<Button variant="outlined" width={96} height={36} content="다시 시도" onClick={onRetry} />}
    />
  );
}
