import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { sourcesQuery, tagsQuery } from '@/features/feed/queries';
import type { SourceListItem } from '@/api/types';
import type { PickerItem } from './ChipPickerModal';

export const POPULAR_TAG_COUNT = 12;
export const QUICK_SOURCE_COUNT = 5;
const ETC = '기타';

export function pickQuickSources(list: SourceListItem[]): { quickSources: SourceListItem[]; quickBasis: 'recent' | 'total' | null } {
  const byName = (a: SourceListItem, b: SourceListItem) => a.name.localeCompare(b.name);
  if (list.some((s) => typeof s.recentPostCount === 'number')) {
    const quickSources = list
      .filter((s) => (s.recentPostCount ?? 0) > 0)
      .sort((a, b) => (b.recentPostCount ?? 0) - (a.recentPostCount ?? 0) || (b.postCount ?? 0) - (a.postCount ?? 0) || byName(a, b))
      .slice(0, QUICK_SOURCE_COUNT);
    return { quickSources, quickBasis: 'recent' };
  }
  if (list.some((s) => typeof s.postCount === 'number')) {
    const quickSources = list
      .filter((s) => (s.postCount ?? 0) > 0)
      .sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0) || byName(a, b))
      .slice(0, QUICK_SOURCE_COUNT);
    return { quickSources, quickBasis: 'total' };
  }
  return { quickSources: [], quickBasis: null };
}

export function useFilterCatalog() {
  const tags = useQuery(tagsQuery);
  const sources = useQuery(sourcesQuery);

  return useMemo(() => {
    const tagList = [...(tags.data ?? [])].sort((a, b) => b.postCount - a.postCount);
    const sourceList = sources.data ?? [];
    const tagItems: PickerItem[] = tagList.map((t) => ({ id: t.id, name: t.name, group: t.category ?? ETC, count: t.postCount }));
    const tagGroups = Array.from(new Set(tagItems.map((t) => t.group))).sort((a, b) =>
      a === ETC ? 1 : b === ETC ? -1 : a.localeCompare(b),
    );
    const sourceItems: PickerItem[] = sourceList.map((s) => ({
      id: s.id,
      name: s.name,
      group: s.type === 'COMPANY' ? '기업' : '개인',
      count: s.postCount,
    }));
    const { quickSources, quickBasis } = pickQuickSources(sourceList);
    return {
      tagItems,
      tagGroups,
      sourceItems,
      sourceGroups: ['기업', '개인'],
      popularTags: tagList.slice(0, POPULAR_TAG_COUNT),
      quickSources,
      quickBasis,
      tagName: (id: number) => tagList.find((t) => t.id === id)?.name ?? `태그 ${id}`,
      sourceName: (id: number) => sourceList.find((s) => s.id === id)?.name ?? `소스 ${id}`,
    };
  }, [tags.data, sources.data]);
}
