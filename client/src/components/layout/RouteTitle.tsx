import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router';

const APP = 'DevFeed';

const TITLES: [string, string][] = [
  ['/tech', '최신 기술 글'],
  ['/tech/for-you', '나를 위한 추천'],
  ['/tech/popular', '인기 기술 글'],
  ['/security', '보안 뉴스'],
  ['/security/popular', '인기 보안 뉴스'],
  ['/community', '자유 게시판'],
  ['/community/popular', '인기 자유 게시판 글'],
  ['/community/new', '글 쓰기'],
  ['/community/posts/:id/edit', '글 고치기'],
  ['/community/posts/:id', '자유 게시판 글'],
  ['/login', '로그인'],
  ['/signup', '회원가입'],
  ['/onboarding/passkey', '패스키 만들기'],
  ['/onboarding/tags', '관심 태그 선택'],
  ['/me/bookmarks', '북마크'],
  ['/me/history', '읽은 기록'],
  ['/me/settings', '설정'],
  ['/privacy', '개인정보 안내'],
  ['/admin', '수집 현황'],
  ['/admin/sources/new', '소스 등록'],
  ['/admin/sources/:id/edit', '소스 수정'],
  ['/admin/sources/:id', '소스 상세'],
  ['/admin/tags', '태그 사전'],
  ['/admin/reports', '신고 관리'],
];

export function titleFor(pathname: string, search: string) {
  if (matchPath('/search', pathname)) {
    const q = new URLSearchParams(search).get('q')?.trim();
    return q ? `검색: ${q} · ${APP}` : `검색 · ${APP}`;
  }
  const hit = TITLES.find(([pattern]) => matchPath(pattern, pathname));
  return hit ? `${hit[1]} · ${APP}` : `페이지를 찾을 수 없어요 · ${APP}`;
}

const NOINDEX_PATTERNS = ['/community/new', '/community/posts/:id/edit', '/login', '/signup', '/onboarding/*', '/me/*', '/admin', '/admin/*'];

export function isNoindex(pathname: string) {
  return NOINDEX_PATTERNS.some((pattern) => matchPath(pattern, pathname));
}

function setRobots(noindex: boolean) {
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!noindex) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'robots';
    document.head.appendChild(meta);
  }
  meta.content = 'noindex';
}

export function RouteTitle() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    document.title = titleFor(pathname, search);
    setRobots(isNoindex(pathname));
  }, [pathname, search]);
  return null;
}
