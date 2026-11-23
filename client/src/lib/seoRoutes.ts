export const SITE_ORIGIN = 'https://formulous.org';
export const SITE_NAME = 'formulous';
export const DEFAULT_TITLE = 'formulous — 기술·보안 뉴스와 개발자 커뮤니티';
export const DEFAULT_DESCRIPTION = '국내 기술 블로그와 보안 뉴스를 모아 읽고 검색하고, 개발자끼리 묻고 나누는 자유 게시판이에요';

export const ROBOTS_INDEX = 'index, follow';
export const ROBOTS_NOINDEX = 'noindex, follow';
export const ROBOTS_PRIVATE = 'noindex, nofollow';

export type Robots = typeof ROBOTS_INDEX | typeof ROBOTS_NOINDEX | typeof ROBOTS_PRIVATE;

export interface SeoRoute {
  pattern: string;
  title: string;
  description: string;
  robots: Robots;
  canonical: string;
  dynamic?: boolean;
}

interface RouteDef {
  pattern: string;
  label: string;
  description?: string;
  robots?: Robots;
  canonical?: string;
  dynamic?: boolean;
}

const fullTitle = (label: string) => `${label} · ${SITE_NAME}`;

const DEFS: RouteDef[] = [
  { pattern: '/', label: '최신 기술 글', robots: ROBOTS_NOINDEX, canonical: '/tech' },
  { pattern: '/for-you', label: '나를 위한 추천', robots: ROBOTS_PRIVATE, canonical: '/tech/for-you' },
  { pattern: '/popular', label: '인기 기술 글', robots: ROBOTS_NOINDEX, canonical: '/tech' },
  { pattern: '/company', label: '최신 기술 글', robots: ROBOTS_NOINDEX, canonical: '/tech' },
  { pattern: '/personal', label: '최신 기술 글', robots: ROBOTS_NOINDEX, canonical: '/tech' },
  { pattern: '/tech', label: '최신 기술 글', description: '국내 기업·개인 기술 블로그의 새 글을 분야·태그별로 모아 보여줘요' },
  { pattern: '/tech/for-you', label: '나를 위한 추천', robots: ROBOTS_PRIVATE },
  { pattern: '/tech/popular', label: '인기 기술 글', description: '많이 읽힌 국내 기술 블로그 글을 기간별로 모아 보여줘요', canonical: '/tech' },
  { pattern: '/tech/comments', label: '댓글 많은 기술 글', description: '개발자들이 댓글로 많이 이야기한 기술 블로그 글이에요', canonical: '/tech' },
  { pattern: '/security', label: '보안 뉴스', description: '국내외 보안 뉴스와 취약점 소식을 지역·출처별로 모아 보여줘요' },
  { pattern: '/security/popular', label: '인기 보안 뉴스', description: '많이 읽힌 보안 뉴스를 기간별로 모아 보여줘요', canonical: '/security' },
  { pattern: '/community', label: '자유 게시판', description: '개발자끼리 질문하고 경험을 나누는 자유 게시판이에요' },
  { pattern: '/community/popular', label: '인기 자유 게시판 글', description: '많이 읽힌 자유 게시판 글이에요', canonical: '/community' },
  { pattern: '/community/comments', label: '댓글 많은 자유 게시판 글', description: '댓글이 많이 달린 자유 게시판 글이에요', canonical: '/community' },
  { pattern: '/community/likes', label: '좋아요 많은 자유 게시판 글', description: '좋아요를 많이 받은 자유 게시판 글이에요', canonical: '/community' },
  { pattern: '/community/new', label: '글 쓰기', robots: ROBOTS_PRIVATE },
  { pattern: '/community/posts/:id', label: '자유 게시판 글', dynamic: true },
  { pattern: '/community/posts/:id/edit', label: '글 고치기', robots: ROBOTS_PRIVATE },
  { pattern: '/search', label: '검색', robots: ROBOTS_NOINDEX },
  { pattern: '/privacy', label: '개인정보 안내', description: 'formulous가 모으는 정보와 쓰는 방법을 안내해요' },
  { pattern: '/login', label: '로그인', robots: ROBOTS_PRIVATE },
  { pattern: '/signup', label: '회원가입', robots: ROBOTS_PRIVATE },
  { pattern: '/onboarding/passkey', label: '패스키 만들기', robots: ROBOTS_PRIVATE },
  { pattern: '/onboarding/tags', label: '관심 태그 선택', robots: ROBOTS_PRIVATE },
  { pattern: '/me/bookmarks', label: '북마크', robots: ROBOTS_PRIVATE },
  { pattern: '/me/history', label: '읽은 기록', robots: ROBOTS_PRIVATE },
  { pattern: '/me/settings', label: '설정', robots: ROBOTS_PRIVATE },
  { pattern: '/admin', label: '수집 현황', robots: ROBOTS_PRIVATE },
  { pattern: '/admin/sources/new', label: '소스 등록', robots: ROBOTS_PRIVATE },
  { pattern: '/admin/sources/:id', label: '소스 상세', robots: ROBOTS_PRIVATE },
  { pattern: '/admin/sources/:id/edit', label: '소스 수정', robots: ROBOTS_PRIVATE },
  { pattern: '/admin/tags', label: '태그 사전', robots: ROBOTS_PRIVATE },
  { pattern: '/admin/reports', label: '신고 관리', robots: ROBOTS_PRIVATE },
];

const toRoute = (d: RouteDef): SeoRoute => ({
  pattern: d.pattern,
  title: fullTitle(d.label),
  description: d.description ?? DEFAULT_DESCRIPTION,
  robots: d.robots ?? ROBOTS_INDEX,
  canonical: d.canonical ?? d.pattern,
  ...(d.dynamic ? { dynamic: true } : {}),
});

export const SEO_ROUTES: SeoRoute[] = DEFS.map(toRoute);

export const NOT_FOUND_ROUTE: SeoRoute = {
  pattern: '*',
  title: fullTitle('페이지를 찾을 수 없어요'),
  description: DEFAULT_DESCRIPTION,
  robots: ROBOTS_NOINDEX,
  canonical: '',
};

export const ROUTES_MANIFEST_VERSION = 1;

export function routesManifest() {
  return {
    version: ROUTES_MANIFEST_VERSION,
    origin: SITE_ORIGIN,
    siteName: SITE_NAME,
    defaultTitle: DEFAULT_TITLE,
    defaultDescription: DEFAULT_DESCRIPTION,
    match: 'exact, first match wins, :param = one path segment',
    routes: SEO_ROUTES,
    notFound: NOT_FOUND_ROUTE,
  };
}
