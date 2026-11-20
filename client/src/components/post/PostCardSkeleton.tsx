export function PostCardSkeleton() {
  return (
    <div className="animate-pulse border-b border-line px-3 py-5 last:border-b-0 sm:px-4" aria-hidden>
      <div className="h-3 w-40 rounded bg-subtle-strong" />
      <div className="mt-3 h-4 w-3/4 rounded bg-subtle-strong" />
      <div className="mt-2 h-3 w-full rounded bg-subtle" />
      <div className="mt-1 h-3 w-5/6 rounded bg-subtle" />
    </div>
  );
}
