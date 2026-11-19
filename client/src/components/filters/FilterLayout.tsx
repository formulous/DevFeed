import { useState, type ReactNode } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import { Modal } from '@/components/common/Modal';
import { ActiveFilterChips } from './ActiveFilterChips';
import { ChipPickerModal } from './ChipPickerModal';
import { FilterPanel } from './FilterPanel';
import { Segment } from './Segment';
import type { FilterBindings } from './types';
import { useFilterCatalog } from './useFilterCatalog';

type Picker = 'tags' | 'sources' | 'segment' | null;

interface FilterLayoutProps {
  b: FilterBindings;
  children: ReactNode;
}

function BarButton({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg-secondary"
    >
      {label}
      {count > 0 && <span className="text-brand">{count}</span>}
      <FiChevronDown size={12} aria-hidden />
    </button>
  );
}

export function FilterLayout({ b, children }: FilterLayoutProps) {
  const [picker, setPicker] = useState<Picker>(null);
  const catalog = useFilterCatalog();
  const close = () => setPicker(null);
  const segDefault = b.segment.options[0]?.value ?? null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        aria-label="필터"
        data-testid="filter-sidebar"
        className="scrollbar-thin hidden lg:sticky lg:top-28 lg:block lg:max-h-[calc(100dvh-8.5rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain"
      >
        <FilterPanel b={b} onOpenTags={() => setPicker('tags')} onOpenSources={() => setPicker('sources')} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex gap-2 lg:hidden" aria-label="필터 열기">
          <BarButton label="태그" count={b.tagIds.length} onClick={() => setPicker('tags')} />
          <BarButton label={b.segment.legend} count={b.segment.value !== segDefault ? 1 : 0} onClick={() => setPicker('segment')} />
          <BarButton label="소스" count={b.sourceIds.length} onClick={() => setPicker('sources')} />
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
      <Modal open={picker === 'segment'} onClose={close} title={b.segment.legend}>
        <Segment
          {...b.segment}
          onChange={(v) => {
            b.segment.onChange(v);
            close();
          }}
        />
      </Modal>
    </div>
  );
}
