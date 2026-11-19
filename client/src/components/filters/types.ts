export interface SegmentOption {
  value: string | null;
  label: string;
}

export interface FilterBindings {
  tagIds: number[];
  sourceIds: number[];
  setTags: (ids: number[]) => void;
  setSources: (ids: number[]) => void;
  toggleTag: (id: number) => void;
  toggleSource: (id: number) => void;
  segment: {
    legend: string;
    options: SegmentOption[];
    value: string | null;
    onChange: (value: string | null) => void;
  };
  reset: () => void;
}

export function activeCount(b: FilterBindings) {
  const def = b.segment.options[0]?.value ?? null;
  return b.tagIds.length + b.sourceIds.length + (b.segment.value !== def ? 1 : 0);
}
