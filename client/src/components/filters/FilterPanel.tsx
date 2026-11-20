import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import { Segment } from './Segment';
import { activeCount, type FilterBindings } from './types';
import { useFilterCatalog } from './useFilterCatalog';

interface FilterPanelProps {
  b: FilterBindings;
  onOpenTags: () => void;
  onOpenSources: () => void;
}

function SectionHead({ title, onAll }: { title: string; onAll: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-xs font-semibold text-fg-secondary">{title}</h3>
      <button type="button" onClick={onAll} className="text-xs font-medium text-fg-secondary hover:text-brand" aria-label={`${title} 전체 보기`}>
        전체 ›
      </button>
    </div>
  );
}

export function ToggleChip({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'max-w-full truncate rounded-full border px-2.5 py-[3px] text-xs transition-colors',
        on ? 'border-inverse bg-inverse text-on-inverse' : 'border-line text-fg-secondary hover:border-line-strong hover:text-fg',
      )}
    >
      {label}
      {count !== undefined && !on && <span className="ml-1 text-fg-muted">{count}</span>}
      {on && ' ✓'}
    </button>
  );
}

const MAX_EXTRA_TAGS = 3;
const MAX_EXTRA_SOURCES = 2;

function MoreChip({ count, noun, onClick }: { count: number; noun: string; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`선택한 ${noun} ${count}개 더 보기`}
      className="rounded-full border border-dashed border-line-strong px-2.5 py-[3px] text-xs font-medium text-fg-secondary hover:text-fg"
    >
      +{count}개
    </button>
  );
}

export function FilterPanel({ b, onOpenTags, onOpenSources }: FilterPanelProps) {
  const catalog = useFilterCatalog();
  const popularIds = new Set(catalog.popularTags.map((t) => t.id));
  const extraSelectedTags = b.tagIds.filter((id) => !popularIds.has(id));
  const quickIds = new Set(catalog.quickSources.map((s) => s.id));
  const selectedSourcesOutsideQuick = b.sourceIds.filter((id) => !quickIds.has(id));
  const count = activeCount(b);

  return (
    <div className="space-y-6 pt-1">
      <section aria-label="태그 필터">
        <SectionHead title="태그" onAll={onOpenTags} />
        <div className="flex flex-wrap gap-1">
          {extraSelectedTags.slice(0, MAX_EXTRA_TAGS).map((id) => (
            <ToggleChip key={id} label={catalog.tagName(id)} on onClick={() => b.toggleTag(id)} />
          ))}
          <MoreChip count={extraSelectedTags.length - MAX_EXTRA_TAGS} noun="태그" onClick={onOpenTags} />
          {catalog.popularTags.map((t) => (
            <ToggleChip key={t.id} label={t.name} count={t.postCount} on={b.tagIds.includes(t.id)} onClick={() => b.toggleTag(t.id)} />
          ))}
        </div>
      </section>

      {b.segment && (
        <section aria-label={`${b.segment.legend} 필터`}>
          <h3 className="mb-2 text-xs font-semibold text-fg-secondary">{b.segment.legend}</h3>
          <Segment {...b.segment} />
        </section>
      )}

      <section aria-label="소스 필터">
        <SectionHead title="소스" onAll={onOpenSources} />
        {selectedSourcesOutsideQuick.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {selectedSourcesOutsideQuick.slice(0, MAX_EXTRA_SOURCES).map((id) => (
              <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-inverse px-2.5 py-[3px] text-xs text-on-inverse">
                <span className="truncate">{catalog.sourceName(id)}</span>
                <button type="button" aria-label={`${catalog.sourceName(id)} 소스 해제`} onClick={() => b.toggleSource(id)}>
                  <FiX size={11} />
                </button>
              </span>
            ))}
            <MoreChip count={selectedSourcesOutsideQuick.length - MAX_EXTRA_SOURCES} noun="소스" onClick={onOpenSources} />
          </div>
        )}
        {catalog.quickSources.length > 0 ? (
          <>
            <p className="mb-1.5 text-xs text-fg-muted">{catalog.quickBasis === 'recent' ? '최근 활발한 소스' : '글 많은 소스'}</p>
            <div className="flex flex-wrap gap-1">
              {catalog.quickSources.map((s) => (
                <ToggleChip key={s.id} label={s.name} on={b.sourceIds.includes(s.id)} onClick={() => b.toggleSource(s.id)} />
              ))}
            </div>
          </>
        ) : (
          b.sourceIds.length === 0 && <p className="text-xs text-fg-muted">"전체 ›"에서 블로그를 골라 모아볼 수 있음</p>
        )}
      </section>

      <div className="flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="text-fg-secondary">선택 {count}개</span>
        <button type="button" onClick={b.reset} disabled={count === 0} className="font-medium text-fg hover:underline disabled:text-fg-muted disabled:no-underline">
          초기화
        </button>
      </div>
    </div>
  );
}
