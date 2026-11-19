import { EmptyState } from '@/components/common/EmptyState';

export function PlaceholderPage({ screenId, title }: { screenId: string; title: string }) {
  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      <EmptyState title={`${screenId} ${title}`} description="화면 준비 중임" />
    </section>
  );
}
