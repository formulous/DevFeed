import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router';

const APP = 'DevFeed';

const TITLES: [string, string][] = [
  ['/', '최신 기술 글'],
  ['/for-you', '나를 위한 추천'],
  ['/popular', '인기 글'],
  ['/login', '로그인'],
  ['/signup', '회원가입'],
  ['/onboarding/tags', '관심 태그 선택'],
  ['/me/bookmarks', '북마크'],
  ['/me/history', '읽은 기록'],
  ['/me/settings', '설정'],
  ['/admin', '수집 현황'],
  ['/admin/sources/new', '소스 등록'],
  ['/admin/sources/:id/edit', '소스 수정'],
  ['/admin/sources/:id', '소스 상세'],
  ['/admin/tags', '태그 사전'],
];

export function titleFor(pathname: string, search: string) {
  if (matchPath('/search', pathname)) {
    const q = new URLSearchParams(search).get('q')?.trim();
    return q ? `검색: ${q} · ${APP}` : `검색 · ${APP}`;
  }
  const hit = TITLES.find(([pattern]) => matchPath(pattern, pathname));
  return hit ? `${hit[1]} · ${APP}` : `페이지를 찾을 수 없음 · ${APP}`;
}

export function RouteTitle() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    document.title = titleFor(pathname, search);
  }, [pathname, search]);
  return null;
}
