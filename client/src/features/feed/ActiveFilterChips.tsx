import { useQuery } from '@tanstack/react-query';
import { Chip } from '@/components/common/Chip';
import { useFeedFilters } from '@/hooks/useFeedFilters';
import { sourcesQuery, tagsQuery } from './queries';

export function ActiveFilterChips() {
  const { filters, isEmpty, toggleTag, toggleSource, setSourceType, reset } = useFeedFilters();
  const tags = useQuery(tagsQuery);
  const sources = useQuery(sourcesQuery);
  if (isEmpty) return null;

  const tagName = (id: number) => tags.data?.find((t) => t.id === id)?.name ?? `태그 ${id}`;
  const sourceName = (id: number) => sources.data?.find((s) => s.id === id)?.name ?? `소스 ${id}`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {filters.tagIds.map((id) => (
        <Chip key={`t${id}`} label={tagName(id)} onRemove={() => toggleTag(id)} />
      ))}
      {filters.sourceIds.map((id) => (
        <Chip key={`s${id}`} label={sourceName(id)} onRemove={() => toggleSource(id)} />
      ))}
      {filters.sourceType && (
        <Chip label={filters.sourceType === 'COMPANY' ? '기업' : '개인'} onRemove={() => setSourceType(null)} />
      )}
      <button type="button" onClick={reset} className="ml-auto text-xs text-fg-secondary hover:text-brand">
        초기화
      </button>
    </div>
  );
}
