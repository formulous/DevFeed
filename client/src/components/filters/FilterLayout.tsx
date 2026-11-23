import { useId, useState, type ReactNode } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ActiveFilterChips } from './ActiveFilterChips';
import { ChipPickerModal } from './ChipPickerModal';
import { FilterPanel } from './FilterPanel';
import { InlinePicker } from './InlinePicker';
import { Segment } from './Segment';
import { segmentDefault, type FilterBindings } from './types';
import { useFilterCatalog } from './useFilterCatalog';
import { cn } from '@/lib/cn';

type Picker = 'tags' | 'sources' | 'segment' | null;

interface FilterLayoutProps {
  b: FilterBindings;
  children: ReactNode;
}

interface BarButtonProps {
  label: string;
  count: number;
  onClick: () => void;
  expanded: boolean;
  controls: string;
}

export function BarButton({ label, count, onClick, expanded, controls }: BarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-xs font-medium',
        expanded ? 'border-line-strong bg-subtle text-fg' : 'border-line text-fg-secondary',
      )}
    >
      {label}
      {count > 0 && <span className="font-semibold text-fg">{count}</span>}
      <FiChevronDown size={12} aria-hidden className={cn('transition-transform', expanded && 'rotate-180')} />
    </button>
  );
}

export function FilterLayout({ b, children }: FilterLayoutProps) {
  const [picker, setPicker] = useState<Picker>(null);
  const [panel, setPanel] = useState<Picker>(null);
  const panelId = useId();
  const catalog = useFilterCatalog();
  const close = () => setPicker(null);
  const toggle = (next: Picker) => setPanel((cur) => (cur === next ? null : next));
  const closePanel = () => setPanel(null);
  const seg = b.segment;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        aria-label="필터"
        data-testid="filter-sidebar"
        className="scrollbar-thin hidden lg:sticky lg:top-[calc(var(--header-h,6.5rem)+1.5rem)] lg:block lg:max-h-[calc(100dvh-var(--header-h,6.5rem)-2.5rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain"
      >
        <ProfileCard />
        <FilterPanel b={b} onOpenTags={() => setPicker('tags')} onOpenSources={() => setPicker('sources')} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <div className="mb-3 flex gap-2" aria-label="필터 열기">
            <BarButton label="태그" count={b.tagIds.length} expanded={panel === 'tags'} controls={panelId} onClick={() => toggle('tags')} />
            {seg && (
              <BarButton
                label={seg.legend}
                count={seg.value !== segmentDefault(b) ? 1 : 0}
                expanded={panel === 'segment'}
                controls={panelId}
                onClick={() => toggle('segment')}
              />
            )}
            <BarButton label="소스" count={b.sourceIds.length} expanded={panel === 'sources'} controls={panelId} onClick={() => toggle('sources')} />
          </div>
          {panel === 'tags' && (
            <InlinePicker
              key="tags"
              id={panelId}
              noun="태그"
              items={catalog.tagItems}
              groups={catalog.tagGroups}
              groupLabel="분류"
              selected={b.tagIds}
              max={MAX_TAG_FILTER}
              onChange={b.setTags}
              onClose={closePanel}
            />
          )}
          {panel === 'sources' && (
            <InlinePicker
              key="sources"
              id={panelId}
              noun="소스"
              items={catalog.sourceItems}
              groups={catalog.sourceGroups}
              groupLabel="유형"
              selected={b.sourceIds}
              max={MAX_SOURCE_FILTER}
              onChange={b.setSources}
              onClose={closePanel}
            />
          )}
          {panel === 'segment' && seg && (
            <div id={panelId} role="region" aria-label={`${seg.legend} 고르기`} data-testid="inline-picker" className="mb-3 rounded-[var(--radius-lg)] border border-line bg-surface p-3">
              <Segment
                {...seg}
                onChange={(v) => {
                  seg.onChange(v);
                  closePanel();
                }}
              />
            </div>
          )}
        </div>
        <ActiveFilterChips b={b} />
        {children}
      </div>

      <ChipPickerModal
        open={picker === 'tags'}
        title="태그 선택"
        noun="태그"
        items={catalog.tagItems}
        groups={catalog.tagGroups}
        groupLabel="분류"
        initial={b.tagIds}
        max={MAX_TAG_FILTER}
        onApply={(ids) => {
          b.setTags(ids);
          close();
        }}
        onClose={close}
      />
      <ChipPickerModal
        open={picker === 'sources'}
        title="소스 선택"
        noun="소스"
        items={catalog.sourceItems}
        groups={catalog.sourceGroups}
        groupLabel="유형"
        initial={b.sourceIds}
        max={MAX_SOURCE_FILTER}
        onApply={(ids) => {
          b.setSources(ids);
          close();
        }}
        onClose={close}
      />
    </div>
  );
}
