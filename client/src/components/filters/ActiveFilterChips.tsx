import { Chip } from '@/components/common/Chip';
import { activeCount, type FilterBindings } from './types';
import { useFilterCatalog } from './useFilterCatalog';

export function ActiveFilterChips({ b }: { b: FilterBindings }) {
  const catalog = useFilterCatalog();
  if (activeCount(b) === 0) return null;
  const def = b.segment.options[0]?.value ?? null;
  const segLabel = b.segment.options.find((o) => o.value === b.segment.value)?.label;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="적용된 필터">
      {b.tagIds.map((id) => (
        <Chip key={`t${id}`} label={catalog.tagName(id)} onRemove={() => b.toggleTag(id)} />
      ))}
      {b.sourceIds.map((id) => (
        <Chip key={`s${id}`} label={catalog.sourceName(id)} onRemove={() => b.toggleSource(id)} />
      ))}
      {b.segment.value !== def && segLabel && <Chip label={segLabel} onRemove={() => b.segment.onChange(def)} />}
      <button type="button" onClick={b.reset} className="ml-auto text-xs text-fg-secondary hover:text-brand">
        초기화
      </button>
    </div>
  );
}
