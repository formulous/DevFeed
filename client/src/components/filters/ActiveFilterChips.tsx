import { Chip } from '@/components/common/Chip';
import { activeCount, segmentDefault, type FilterBindings } from './types';
import { useFilterCatalog } from './useFilterCatalog';

export function ActiveFilterChips({ b }: { b: FilterBindings }) {
  const catalog = useFilterCatalog(b.sourceScope);
  if (activeCount(b) === 0) return null;
  const seg = b.segment;
  const def = segmentDefault(b);
  const segLabel = seg?.options.find((o) => o.value === seg.value)?.label;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="적용된 필터">
      {b.tagIds.map((id) => (
        <Chip key={`t${id}`} label={catalog.tagName(id)} onRemove={() => b.toggleTag(id)} />
      ))}
      {b.sourceIds.map((id) => (
        <Chip key={`s${id}`} label={catalog.sourceName(id)} onRemove={() => b.toggleSource(id)} />
      ))}
      {seg && seg.value !== def && segLabel && <Chip label={segLabel} onRemove={() => seg.onChange(def)} />}
      <button type="button" onClick={b.reset} className="ml-auto text-xs text-fg-secondary hover:text-brand">
        초기화
      </button>
    </div>
  );
}
