import type { PostSummary, SecurityNewsSource, SourceRef, TagItem } from '@/api/types';

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

const EXTRA_TAGS = [
  'Go', 'Rust', 'Python', 'Java', 'JavaScript', 'Node.js', 'NestJS', 'Vue', 'Svelte', 'GraphQL',
  'gRPC', 'PostgreSQL', 'MongoDB', 'ClickHouse', 'Airflow', 'Spark', 'Terraform', 'ArgoCD', 'Prometheus', 'Grafana',
  'OpenTelemetry', 'Istio', 'RAG', 'MLOps', 'Android', 'iOS', 'Unity', 'WebAssembly', 'Security', 'Testing',
];

export const mockExtraSources: SourceRef[] = Array.from({ length: 28 }, (_, i) => ({
  id: 100 + i,
  name: `${i % 2 === 0 ? '테크' : '개발'} 블로그 ${i + 1}`,
  logoUrl: null,
  type: i % 3 === 0 ? 'PERSONAL' : 'COMPANY',
}));

export const mockTags: TagItem[] = TAGS.map(([name, category], i): TagItem => ({
  id: i + 1,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  category,
  postCount: mockPosts.filter((p) => p.tags.some((t) => t.id === i + 1)).length,
})).concat(
  EXTRA_TAGS.map((name, i): TagItem => ({
    id: 100 + i,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: name === 'Security' ? '보안' : null,
    postCount: 0,
  })),
)
  .sort((a, b) => b.postCount - a.postCount);

export const mockNewsSources: SecurityNewsSource[] = [
  { id: 200, name: '데일리시큐', logoUrl: null, region: 'DOMESTIC' },
  { id: 201, name: 'KISA 보호나라', logoUrl: null, region: 'DOMESTIC' },
  { id: 202, name: 'AhnLab ASEC', logoUrl: null, region: 'DOMESTIC' },
  { id: 203, name: 'BleepingComputer', logoUrl: null, region: 'OVERSEAS' },
  { id: 204, name: 'SecurityWeek', logoUrl: null, region: 'OVERSEAS' },
  { id: 205, name: 'The Hacker News', logoUrl: null, region: 'OVERSEAS' },
];

const NEWS_TITLES: Record<'DOMESTIC' | 'OVERSEAS', string[]> = {
  DOMESTIC: [
    '국내 쇼핑몰 회원정보 유출 사고 조사 착수',
    '공유기 펌웨어 원격 코드 실행 취약점 보안 업데이트 권고',
    '정보 탈취형 악성코드 유포 동향 분석',
    '랜섬웨어 피해 기업 복구 지원 절차 안내',
  ],
  OVERSEAS: [
    'Critical zero-day in VPN appliances exploited in the wild',
    'New phishing kit targets Microsoft 365 accounts with MFA bypass',
    'Supply chain attack hits popular npm packages',
    'Ransomware gang leaks data stolen from healthcare provider',
  ],
};

const NEWS_SUMMARY =
  '보안 업데이트가 공개됐음. 영향받는 버전 사용자는 즉시 최신 버전으로 업데이트하고, 외부 노출 서비스의 접근 기록을 점검하라고 권고함. 공격 지표와 대응 방법은 원문에서 확인할 수 있음. 추가 분석 결과는 확인되는 대로 공개 예정임.';

export const mockNewsPosts: PostSummary[] = Array.from({ length: 30 }, (_, i) => {
  const source = mockNewsSources[i % mockNewsSources.length];
  const titles = NEWS_TITLES[source.region];
  const id = 1000 + 30 - i;
  return {
    id,
    title: `${titles[i % titles.length]} (${id})`,
    summary: i % 7 === 6 ? null : NEWS_SUMMARY.slice(0, 150),
    url: `https://example.com/news/${id}`,
    thumbnailUrl: null,
    publishedAt: new Date(BASE_TIME - i * 110 * 60_000).toISOString(),
    source: { id: source.id, name: source.name, logoUrl: null, type: 'COMPANY' },
    tags: [{ id: 128, name: 'Security' }],
  };
});
