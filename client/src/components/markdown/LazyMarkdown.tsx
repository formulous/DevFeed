import { lazy, Suspense } from 'react';

const Markdown = lazy(() => import('./Markdown'));

export function LazyMarkdown({ source, className }: { source: string; className?: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap break-words text-sm text-fg-secondary">{source}</p>}>
      <Markdown source={source} className={className} />
    </Suspense>
  );
}
