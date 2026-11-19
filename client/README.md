# DevFeed client

- 담당: `client`
- 상태: 스캐폴딩 v1 (2026-11-19). 전체 라우트·가드·레이아웃 + S-01 홈 피드 동작. 나머지 화면은 자리표시 페이지
- API 타입·mock은 `docs/api/openapi.yaml` v1(004에서 승인)과 `docs/api/conventions.md` 기준. 현재 구현 범위(posts, tags, sources, auth, me, bookmarks, views)만 반영
- 기준 문서: `docs/spec/02-features.md`, `docs/spec/03-screens.md`

## 기술 스택 (안)
| 영역 | 선택 | 이유 |
|---|---|---|
| 빌드 | Vite + React 19 + TypeScript | 팀 공통 기준, salary_calc와 동일 |
| 스타일 | Tailwind CSS 3 + onyx-ui 토큰 | onyx-ui가 Tailwind 3 기반 |
| 라우팅 | react-router 7 (data router 아님, `<Routes>` 선언형) | 가드·레이아웃 중첩, 관리자 화면 lazy 로딩 |
| 서버 상태 | @tanstack/react-query 5 | 커서 무한 스크롤(`useInfiniteQuery`), 북마크 낙관적 업데이트, 캐시 무효화 |
| URL 상태 | `useSearchParams` | F-011 필터 공유·새로고침 유지 |
| 인증 상태 | React Context (`AuthProvider`) | 전역 상태가 사용자·토큰뿐이라 별도 상태 라이브러리 불필요 |
| mock | MSW 2 | openapi 기반 핸들러, 서버 완성 후 환경변수로 끔 |
| 테스트 | Vitest 5 + happy-dom + Testing Library + MSW(node) | jsdom은 Node fetch와 AbortSignal 불일치로 React Query 요청이 실패해 happy-dom 사용 |

## onyx-ui 매핑
| 필요 UI | onyx-ui | 비고 |
|---|---|---|
| 버튼 | `Button` | |
| 입력(이메일·비밀번호·검색) | `TextField` | password 토글 내장 |
| 정렬·태그 선택 드롭다운 | `Select` | |
| 텍스트 | `Text` | |
| 카드 컨테이너 | `Card` | |
| 레이아웃 | `FlexRow`, `FlexCol`, `HorizonDivider` | |
| 헤더·푸터 | 사용 안 함 | `SiteHeader`가 formulous 브랜드·링크 고정 → `client/src/components/layout/AppHeader` 자체 구현 |
| 모달 | 사용 안 함 | `Dialog`가 `open`/`onClose` prop을 무시하고 Confirm/Close 버튼이 고정됨 → `client/src/components/Modal` 자체 구현 (확인 모달·로그인 유도·탈퇴) |

- 자체 구현 컴포넌트: `PostCard`, `PostCardSkeleton`, `Chip`(필터·태그 칩), `Tabs`, `Pagination`, `Modal`, `Highlight`, `EmptyState`, `ErrorState`, `StatusBadge`(관리자), `DataTable`(관리자)
- onyx-ui 개선이 필요해지면 `onyx-ui-change` 절차로 사용자 승인 후 진행

## 라우트
| 경로 | 화면 | 가드 | 레이아웃 |
|---|---|---|---|
| `/` | S-01 HomePage | - | AppLayout + FeedSidebar |
| `/for-you` | S-02 ForYouPage | RequireAuth | AppLayout |
| `/popular` | S-03 PopularPage | - | AppLayout |
| `/search?q=` | S-04 SearchPage | - | AppLayout + SearchSidebar |
| `/login` | S-05 LoginPage | GuestOnly | AuthLayout |
| `/signup` | S-06 SignupPage | GuestOnly | AuthLayout |
| `/onboarding/tags` | S-07 OnboardingTagsPage | RequireAuth | AuthLayout |
| `/me/bookmarks` | S-08 BookmarksPage | RequireAuth | AppLayout |
| `/me/history` | S-09 HistoryPage | RequireAuth | AppLayout |
| `/me/settings` | S-10 SettingsPage | RequireAuth | AppLayout |
| `/admin` | A-01 AdminDashboardPage | RequireAdmin | AdminLayout (lazy) |
| `/admin/sources/new` | A-03 SourceFormPage | RequireAdmin | AdminLayout (lazy) |
| `/admin/sources/:id` | A-02 SourceDetailPage | RequireAdmin | AdminLayout (lazy) |
| `/admin/sources/:id/edit` | A-03 SourceFormPage | RequireAdmin | AdminLayout (lazy) |
| `/admin/tags` | A-04 TagDictionaryPage | RequireAdmin | AdminLayout (lazy) |
| `*` | NotFoundPage | - | AppLayout |

- RequireAuth: 비로그인 시 `/login?redirect=<현재경로>`로 이동, 로그인 후 복귀 (S-05 "원래 보던 화면으로 복귀")
- 관리자 화면은 `React.lazy`로 별도 청크 분리 → 일반 사용자 번들에서 제외

## 디렉터리 구조
```
client/src/
  main.tsx            dev에서 MSW worker 시작 후 렌더링
  App.tsx             라우트 정의 (관리자는 lazy 청크)
  Providers.tsx       QueryClient → AuthProvider → LoginPromptProvider
  api/                http.ts(fetch 래퍼·TOKEN_EXPIRED 재시도), types.ts, posts.ts, auth.ts
  auth/               AuthProvider.tsx, LoginPromptProvider.tsx, guards.tsx(RequireAuth·RequireAdmin·GuestOnly)
  components/         layout/(AppHeader·AppLayout·AuthLayout), post/(PostCard·Skeleton), common/(Modal·Chip·Highlight·EmptyState·ErrorState)
  features/           feed/(HomePage·FeedSidebar·ActiveFilterChips·queries), admin/AdminRoutes, common/(Placeholder·NotFound)
  hooks/              useFeedFilters(URL ↔ 필터), useInfiniteScroll, usePostActions(북마크 낙관적 토글·조회 기록)
  lib/                highlight.ts, time.ts, cn.ts
  mocks/              fixtures.ts, handlers.ts, browser.ts, node.ts
client/tests/         setup.ts, render.tsx, *.test.ts(x)
```

## 컴포넌트 트리 (핵심)
```
App
└ QueryClientProvider
  └ AuthProvider
    └ LoginPromptProvider          ← 게스트가 ☆/추천 클릭 시 로그인 유도 모달
      └ Routes
        ├ AppLayout
        │ ├ AppHeader (로고, SearchBox, NavTabs 최신|추천|인기, ProfileMenu)
        │ └ Outlet
        │   ├ HomePage
        │   │ ├ FeedSidebar (TagFilter, SourceTypeFilter, SourceFilter) / 모바일: FilterDrawer
        │   │ ├ ActiveFilterChips
        │   │ └ PostList (PostCard[], PostCardSkeleton, sentinel)
        │   ├ ForYouPage → InterestTagBar, RecommendCard(PostCard + reasons)
        │   ├ PopularPage → Tabs(today|week|month), RankedPostCard[]
        │   ├ SearchPage → SearchSidebar, SortSelect, PostCard(highlight), Pagination
        │   └ Me*Pages
        ├ AuthLayout → LoginPage / SignupPage / OnboardingTagsPage
        └ AdminLayout (lazy) → Admin*Pages
```

## 상태 관리 원칙
- 서버 데이터는 모두 React Query 캐시. 컴포넌트 로컬 상태로 복사하지 않음
- 필터·검색어·정렬·페이지·인기 기간은 URL 쿼리가 단일 출처
- 액세스 토큰은 메모리(Context)에만 보관, 리프레시 토큰은 httpOnly 쿠키 가정 → 새로고침 시 `/auth/refresh`로 복구
- 401 응답 시 1회 refresh 후 재시도, 동시 요청은 refresh 1번만 수행 (단일 Promise 공유)
- 북마크 토글: `onMutate`에서 피드·북마크·검색 캐시의 해당 글 `isBookmarked`를 즉시 반영, 실패 시 롤백

## 주요 처리 방식
- 원문 이동(F-012): 카드는 `<a href={원문} target="_blank" rel="noopener noreferrer">`. 클릭 시 `fetch(keepalive)`로 조회 기록 API 호출. 기록 실패가 이동을 막지 않음
- 하이라이트(F-022): 서버 HTML을 쓰지 않고, 검색어를 토큰으로 나눠 클라이언트에서 `<mark>` 요소로 렌더링 (`dangerouslySetInnerHTML` 금지)
- 무한 스크롤(F-010): IntersectionObserver sentinel + `useInfiniteQuery`의 `nextCursor`
- 읽은 글 흐림: 응답의 `isRead`로 `opacity-60`
- 반응형: `lg` 미만에서 사이드바를 상단 필터 버튼 + 드로어로 전환. 최소 360px

## 클라이언트 쪽 한계·리스크
| 항목 | 내용 | 대응 |
|---|---|---|
| 외부 썸네일·로고 | 원작자 서버 이미지 핫링크. 느리거나 깨짐, 일부는 Referer 차단 | `loading="lazy"`, `referrerPolicy="no-referrer"`, 고정 크기·onError 시 플레이스홀더 |
| 무한 스크롤 DOM 증가 | 수백 건 이상 시 스크롤 성능 저하 | 초기엔 단순 리스트, 500건 넘으면 가상화 검토 |
| 조회 기록 누락 | 새 탭 이동 직후 요청 취소 가능 | `keepalive` 사용, 누락 일부 허용 |
| 토큰 저장 | localStorage 저장은 XSS 노출 | 메모리 + httpOnly 쿠키 (서버 협의 필요) |
| 검색어 하이라이트 | ngram 매칭 결과와 클라이언트 단순 매칭이 다를 수 있음 | MVP는 공백 분리 토큰 부분 일치로 충분하다고 봄 |

## API 협의
- `docs/discussions/001-client-api-requirements.md`: 화면 기준 요구사항 (합의)
- `docs/discussions/004-openapi-review.md`: openapi v1 검토 (decided)
- 화면 반영 메모
  - 로그인·refresh 응답 `user`로 `GET /me` 생략. `onboardingCompleted=false`면 S-07로 이동
  - S-02 콜드 스타트 안내는 `fallback`, 헤더 관심 태그 [편집]/[설정] 버튼 분기는 `hasInterestTags`
  - S-03 기간 탭 문구: 24시간 / 7일 / 30일 (롤링 윈도우)
  - S-10 관심 태그 3개일 때 ✕ 비활성 + 최소 3개 안내
  - 필터 상한: 태그 10, 소스 20 (URL 해석 시에도 잘라냄)
  - 추천 클릭 시 해당 카드가 실린 페이지의 `recommendationId` 전송, `INVALID_CURSOR`면 첫 페이지부터 재요청

## 실행
```bash
npm install
npm run dev        # http://localhost:5175, MSW mock 사용
npm run build
npm test
```
- dev 기본은 MSW mock. 실제 서버(`localhost:3000`)에 붙이려면 `VITE_API_MOCK=false npm run dev` (Vite proxy `/api` → `:3000`)
- mock 로그인: 로그인 화면 구현 전이라 아직 UI로는 불가. mock `POST /api/auth/login`은 아무 이메일·비밀번호나 통과, `admin`으로 시작하는 이메일은 ADMIN

## 진행 현황
- [x] 스캐폴딩, onyx-ui 연결, 라우트·가드·레이아웃
- [x] S-01 홈 피드: 카드, 태그·소스·유형 필터(URL 동기화), 무한 스크롤, 스켈레톤·빈 결과·오류 상태, 북마크 낙관적 토글, 조회 기록(keepalive), 게스트 로그인 유도 모달
- [ ] S-05/S-06 로그인·회원가입, S-07 온보딩
- [ ] S-03 인기, S-04 검색, S-02 추천
- [ ] S-08~S-10 회원 화면
- [ ] A-01~A-04 관리자 화면
- [x] openapi v1 기준 타입·mock 정렬 (구현 범위 한정, 나머지는 화면 구현 시 추가)
