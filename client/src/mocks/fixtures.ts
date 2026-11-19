import type { PostSummary, SourceRef, TagItem } from '@/api/types';

export const mockSources: SourceRef[] = [
  { id: 1, name: '토스 기술블로그', logoUrl: null, type: 'COMPANY' },
  { id: 2, name: '우아한형제들 기술블로그', logoUrl: null, type: 'COMPANY' },
  { id: 3, name: '카카오 기술블로그', logoUrl: null, type: 'COMPANY' },
  { id: 4, name: '네이버 D2', logoUrl: null, type: 'COMPANY' },
  { id: 5, name: '당근 테크', logoUrl: null, type: 'COMPANY' },
  { id: 6, name: '라인 엔지니어링', logoUrl: null, type: 'COMPANY' },
  { id: 7, name: '개발자 김씨 블로그', logoUrl: null, type: 'PERSONAL' },
  { id: 8, name: '프론트엔드 일지', logoUrl: null, type: 'PERSONAL' },
];

const TAGS: [string, string][] = [
  ['Kafka', '백엔드'],
  ['Spring', '백엔드'],
  ['MySQL', '데이터'],
  ['Redis', '데이터'],
  ['React', '프론트엔드'],
  ['TypeScript', '프론트엔드'],
  ['Kubernetes', '인프라'],
  ['Docker', '인프라'],
  ['AWS', '인프라'],
  ['LLM', 'AI'],
  ['Kotlin', '백엔드'],
  ['Next.js', '프론트엔드'],
  ['Elasticsearch', '데이터'],
  ['Swift', '모바일'],
  ['Flutter', '모바일'],
];

const TITLES = [
  '카프카 컨슈머 리밸런싱 줄이기',
  '대규모 트래픽에서 Redis 캐시 전략',
  'React Server Components 도입기',
  'Kubernetes 오토스케일링 튜닝 경험',
  'MySQL 인덱스 설계 실수 모음',
  'TypeScript 타입 안전한 API 클라이언트 만들기',
  'LLM으로 사내 문서 검색 개선하기',
  'Spring Batch 성능 개선 사례',
  'Docker 이미지 크기 80% 줄이기',
  'Next.js App Router 마이그레이션 회고',
  'Elasticsearch 한글 형태소 분석기 비교',
  'Kotlin 코루틴 실전 디버깅',
  'Flutter와 Swift 하이브리드 앱 운영기',
];

const BASE_TIME = Date.parse('2026-11-19T09:00:00.000Z');

function buildPosts(count: number): PostSummary[] {
  return Array.from({ length: count }, (_, i) => {
    const id = count - i;
    const source = mockSources[i % mockSources.length];
    const title = TITLES[i % TITLES.length];
    const tagIdx = [i % TAGS.length, (i * 7 + 3) % TAGS.length];
    const tags = Array.from(new Set(tagIdx)).map((t) => ({ id: t + 1, name: TAGS[t][0] }));
    return {
      id,
      title: `${title} #${id}`,
      summary: i % 11 === 10 ? null : `${title}에 대한 정리임. 실무에서 겪은 문제와 해결 과정을 단계별로 설명하고, 측정 수치와 함께 개선 효과를 공유함.`,
      url: `https://example.com/posts/${id}`,
      thumbnailUrl: i % 3 === 0 ? null : `https://picsum.photos/seed/devfeed${id}/224/160`,
      publishedAt: new Date(BASE_TIME - i * 180 * 60_000).toISOString(),
      source,
      tags,
    };
  });
}

export const mockPosts = buildPosts(65);

export const mockTags: TagItem[] = TAGS.map(([name, category], i) => ({
  id: i + 1,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  category,
  postCount: mockPosts.filter((p) => p.tags.some((t) => t.id === i + 1)).length,
})).sort((a, b) => b.postCount - a.postCount);
