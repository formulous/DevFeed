import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button } from '@onyx/components/button/button';
import type { NewsRegion, PostSummary, SecurityNewsSource } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Chip } from '@/components/common/Chip';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ChipPickerModal } from '@/components/filters/ChipPickerModal';
import { BarButton } from '@/components/filters/FilterLayout';
import { ToggleChip } from '@/components/filters/FilterPanel';
import { Segment } from '@/components/filters/Segment';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { localDateKey } from '@/features/me/HistoryPage';
import { dayLabel } from '@/lib/time';
import { securityNewsQuery, securitySourcesQuery } from './queries';
import { MAX_NEWS_SOURCES, useSecurityNewsState } from './useSecurityNewsState';

const REGION_LABEL: Record<NewsRegion, string> = { DOMESTIC: '국내', OVERSEAS: '해외' };
const REGION_OPTIONS = [
  { value: null, label: '전체' },
  { value: 'DOMESTIC', label: '국내' },
  { value: 'OVERSEAS', label: '해외' },
];

export function groupByDay(posts: PostSummary[]) {
  const groups: { key: string; label: string; items: PostSummary[] }[] = [];
  for (const post of posts) {
    const key = localDateKey(post.publishedAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(post);
    else groups.push({ key, label: dayLabel(post.publishedAt), items: [post] });
  }
  return groups;
}

function SourcePanel({
  sources,
  selected,
  onToggle,
  onReset,
  count,
}: {
  sources: SecurityNewsSource[];
  selected: number[];
  onToggle: (id: number) => void;
  onReset: () => void;
  count: number;
}) {
  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3.5">
      {(['DOMESTIC', 'OVERSEAS'] as const).map((region) => {
        const list = sources.filter((s) => s.region === region);
        if (list.length === 0) return null;
        return (
          <section key={region} aria-label={`${REGION_LABEL[region]} 출처`}>
            <h3 className="mb-1.5 text-sm font-semibold">{REGION_LABEL[region]} 출처</h3>
            <div className="flex flex-wrap gap-1">
              {list.map((s) => (
                <ToggleChip key={s.id} label={s.name} on={selected.includes(s.id)} onClick={() => onToggle(s.id)} />
              ))}
            </div>
          </section>
        );
      })}
      <div className="flex items-center justify-between border-t border-line pt-2.5 text-xs">
        <span className="text-fg-secondary">선택 {count}개</span>
        <button type="button" onClick={onReset} disabled={count === 0} className="font-medium text-brand disabled:text-fg-muted">
          초기화
        </button>
      </div>
    </div>
  );
}

export function SecurityNewsPage() {
  const { status } = useAuth();
  const state = useSecurityNewsState();
  const { query } = state;
  const [picking, setPicking] = useState(false);
  const sources = useQuery(securitySourcesQuery);
  const list = useInfiniteQuery({ ...securityNewsQuery(query, status), enabled: status !== 'loading' });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();
  const sentinelRef = useInfiniteScroll(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  }, list.hasNextPage && !list.isError);

  const sourceList = useMemo(() => sources.data ?? [], [sources.data]);
  const posts = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const groups = useMemo(() => groupByDay(posts), [posts]);
  const sourceName = (id: number) => sourceList.find((s) => s.id === id)?.name ?? `출처 ${id}`;
  const pickerItems = sourceList.map((s) => ({ id: s.id, name: s.name, group: REGION_LABEL[s.region] }));

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        aria-label="출처 필터"
        className="scrollbar-thin hidden lg:sticky lg:top-[calc(var(--header-h,6.5rem)+1.5rem)] lg:block lg:max-h-[calc(100dvh-var(--header-h,6.5rem)-2.5rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto"
      >
        <SourcePanel
          sources={sourceList}
          selected={query.sourceIds}
          onToggle={state.toggleSource}
          onReset={state.reset}
          count={state.activeCount}
        />
      </aside>

      <section className="min-w-0 flex-1" aria-label="보안 뉴스">
        <h1 className="sr-only">보안 뉴스</h1>
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 lg:max-w-xs">
            <Segment
              legend="지역"
              options={REGION_OPTIONS}
              value={query.region}
              onChange={(v) => state.setRegion(v as NewsRegion | null)}
            />
          </div>
          <div className="shrink-0 lg:hidden">
            <BarButton label="출처" count={query.sourceIds.length} onClick={() => setPicking(true)} />
          </div>
        </div>
        {query.sourceIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="적용된 필터">
            {query.sourceIds.map((id) => (
              <Chip key={id} label={sourceName(id)} onRemove={() => state.toggleSource(id)} />
            ))}
            <button type="button" onClick={state.reset} className="ml-auto text-xs text-fg-secondary hover:text-brand">
              초기화
            </button>
          </div>
        )}
        <p className="mb-3 text-xs text-fg-muted">국내·해외 보안 매체의 최신 기사 제목과 요약만 보여줌. 전문은 원문에서 확인</p>

        {list.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : list.isError && posts.length === 0 ? (
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState
            title="조건에 맞는 보안 뉴스가 없음"
            action={<Button variant="outlined" width={96} height={36} content="필터 초기화" onClick={state.reset} />}
          />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <h2 className="mb-2 flex items-center gap-3 text-xs font-semibold text-fg-secondary">
                  <span className="shrink-0">{g.label}</span>
                  <span className="h-px flex-1 bg-line" aria-hidden />
                </h2>
                <ul className="space-y-3">
                  {g.items.map((post) => (
                    <li key={post.id}>
                      <PostCard post={post} badges="new" summaryLines={2} onOpen={openPost} onToggleBookmark={toggleBookmark} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div ref={sentinelRef} />
        {list.isFetchingNextPage && (
          <div className="mt-3">
            <PostCardSkeleton />
          </div>
        )}
        {list.isError && posts.length > 0 && (
          <div className="mt-3 text-center">
            <button type="button" onClick={() => list.fetchNextPage()} className="text-sm text-brand">
              더 불러오지 못했음. 다시 시도
            </button>
          </div>
        )}
      </section>

      <ChipPickerModal
        open={picking}
        title="출처 선택"
        noun="출처"
        items={pickerItems}
        groups={['국내', '해외']}
        groupLabel="지역"
        initial={query.sourceIds}
        max={MAX_NEWS_SOURCES}
        onApply={(ids) => {
          state.setSources(ids);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}
