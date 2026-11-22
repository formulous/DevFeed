import { useState, type ReactNode } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { MAX_SOURCE_FILTER, MAX_TAG_FILTER } from '@/api/posts';
import { Modal } from '@/components/common/Modal';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ActiveFilterChips } from './ActiveFilterChips';
import { ChipPickerModal } from './ChipPickerModal';
import { FilterPanel } from './FilterPanel';
import { Segment } from './Segment';
import { segmentDefault, type FilterBindings } from './types';
import { useFilterCatalog } from './useFilterCatalog';

type Picker = 'tags' | 'sources' | 'segment' | null;

interface FilterLayoutProps {
  b: FilterBindings;
  children: ReactNode;
}

export function BarButton({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line px-3 text-xs font-medium text-fg-secondary"
    >
      {label}
      {count > 0 && <span className="font-semibold text-fg">{count}</span>}
      <FiChevronDown size={12} aria-hidden />
    </button>
  );
}

export function FilterLayout({ b, children }: FilterLayoutProps) {
  const [picker, setPicker] = useState<Picker>(null);
  const catalog = useFilterCatalog();
  const close = () => setPicker(null);
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
        <div className="mb-3 flex gap-2 lg:hidden" aria-label="필터 열기">
          <BarButton label="태그" count={b.tagIds.length} onClick={() => setPicker('tags')} />
          {seg && (
            <BarButton label={seg.legend} count={seg.value !== segmentDefault(b) ? 1 : 0} onClick={() => setPicker('segment')} />
          )}
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
      {seg && (
        <Modal open={picker === 'segment'} onClose={close} title={seg.legend}>
          <Segment
            {...seg}
            onChange={(v) => {
              seg.onChange(v);
              close();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
