import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-line bg-surface px-4 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="text-sm text-fg-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
