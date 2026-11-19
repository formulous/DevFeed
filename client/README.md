# DevFeed client

- 담당: `client`
- 상태: M3 진행 중 (2026-11-19). S-01 홈 피드, S-03 인기 글, S-04 검색, S-05 로그인, A-01~A-04 관리자 화면 동작. 나머지 화면은 자리표시 페이지
- 검증 환경: Node 24.22.3
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
  api/                http.ts(fetch 래퍼·TOKEN_EXPIRED 재시도), types.ts, posts.ts, search.ts, auth.ts, admin.ts
  auth/               AuthProvider.tsx, LoginPromptProvider.tsx, guards.tsx(RequireAuth·RequireAdmin·GuestOnly)
  components/         layout/(AppHeader·AppLayout·AuthLayout), post/(PostCard·Skeleton), common/(Modal·ConfirmModal·FieldError·Chip·Highlight·Pagination·EmptyState·ErrorState), filters/CheckList(홈·검색 사이드바 공용)
  features/           feed/(HomePage·FeedSidebar·ActiveFilterChips·queries), popular/PopularPage, search/(SearchPage·SearchSidebar), auth/LoginPage,
                      admin/(AdminRoutes·AdminDashboardPage·SourceDetailPage·SourceFormPage·TagDictionaryPage·TagFormModal·StatusBadge·queries),
                      common/(Placeholder·NotFound)
  hooks/              useFeedFilters(URL ↔ 필터), useInfiniteScroll, usePostActions(북마크 낙관적 토글·조회 기록), useSearchState(URL ↔ 검색 상태), useDebouncedValue
  lib/                highlight.ts, time.ts, format.ts, errors.ts(ApiError → 필드 오류 맵), cn.ts
  mocks/              fixtures.ts, handlers.ts, adminFixtures.ts, adminHandlers.ts, browser.ts, node.ts
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

## 인기 글 (S-03, M2)
- 기간 탭 24시간 / 7일 / 30일 (`period=DAY|WEEK|MONTH`, 롤링 윈도우). 기본 7일이고 기본값이면 URL에서 `period`를 뺌
- 순위 1~20, 카드 하단에 조회수. 상위 3위는 강조색
- 조회수 1 이상인 글만 순위에 오름 (`docs/discussions/008` 결정). 결과가 없으면 빈 화면 + 최신 피드(S-01) 링크
- 북마크·읽음 즉시 반영은 무한 스크롤 캐시(`pages`)와 단일 목록 캐시(`items`) 모두 처리 (`hooks/usePostActions.ts`)

## 검색 (S-04, M3)
- 검색어·태그·소스·기간·정렬·페이지가 모두 URL 쿼리. 기본값(`period=ALL`, `sort=RELEVANCE`, `page=1`)은 URL에서 뺌
- 필터·정렬이 바뀌면 page를 1로 되돌림. 페이지 이동 중에는 이전 결과를 흐리게 유지(`keepPreviousData`)
- 페이지 번호는 최대 50 (명세 상한, 상위 1,000건). 마지막 페이지에서 상한 안내
- 검색어 2~50자. 1자면 헤더 검색 버튼 비활성, URL로 들어와도 요청하지 않고 안내
- 하이라이트: 검색어를 공백으로 나눈 토큰을 텍스트 노드 `<mark>`로 표시 (`lib/highlight.ts`)
- 결과 없음: 철자 안내 + 인기 태그 10개 칩(누르면 태그명으로 검색), 필터가 있으면 [필터 초기화]
- 정렬은 네이티브 `<select>` 사용. onyx `Select`는 `aria-label` 미전달·키보드 조작 불가라 접근성 기준을 못 맞춤

## 관리자 화면 동작 (M1)
- A-01: 요약 3칸, 상태 필터 `?status=` URL 반영, md 미만은 표 대신 카드 목록
- A-02: [지금 수집] 후 이력에 `RUNNING`이 있으면 3초마다 이력 갱신, 끝나면 상세·요약 재조회. 비활성화·재활성화는 확인 모달, `ERROR`일 때만 [재개]
- A-03: 새로 등록하거나 피드 URL을 바꾸면 [검증] 통과(유효 + 중복 아님) 후에만 저장. 수정은 바뀐 필드만 PATCH. 클라이언트 검증 + 서버 `fieldErrors` 필드별 표시
- A-04: 검색 300ms 디바운스, 추가·수정 모달(이름에서 slug 자동 생성), 재태깅 `202 jobId` 후 1.5초 간격 진행률 폴링
- 로그인: 성공 시 `redirect`로 복귀, `onboardingCompleted=false`면 `/onboarding/tags?redirect=`로 이동 (`GuestOnly`가 처리). `LOGIN_LOCKED`는 남은 시간 카운트다운

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
- dev 기본은 MSW mock. 실제 서버에 붙이려면 `VITE_API_MOCK=false npm run dev` (Vite proxy `/api` → 기본 `http://localhost:3000`)
  - proxy 대상은 `VITE_API_TARGET`으로 바꿈. 예: `VITE_API_MOCK=false VITE_API_TARGET=http://localhost:3100 npm run dev` (포트 결정은 `docs/discussions/005` 4번, 사용자 결정 대기)
- mock 로그인 (`/login`, 새로고침하면 로그아웃됨)
  - 아무 이메일·비밀번호나 통과. `admin`으로 시작하는 이메일은 ADMIN + 온보딩 완료 상태
  - 비밀번호 `wrong` → 자격 증명 오류, `locked` → 로그인 잠김(10분)
- mock 관리자 데이터
  - 피드 URL에 `invalid`·`timeout`이 들어가면 검증 실패, 기존 소스 피드 URL(`https://blog1.example.com/rss` 등)은 중복
  - 즉시 수집은 2.5초 뒤 성공 처리, 재태깅은 조회할 때마다 400건씩 진행 (총 1,000건)

## 실서버 확인 (M1)
- 대상: `localhost:3000` 실서버, `VITE_API_MOCK=false npm run dev`
- 2026-11-19 인증 오류 응답 대조: 모두 client 처리와 일치
  | 요청 | 응답 | client 처리 |
  |---|---|---|
  | 틀린 비밀번호 로그인 | 401 `INVALID_CREDENTIALS` | 폼 오류 문구 |
  | 형식 오류 로그인 | 400 `VALIDATION_FAILED` + `fieldErrors`(email, password) | 필드 아래 표시 |
  | 쿠키 없이 refresh | 401 `REFRESH_TOKEN_INVALID` | 게스트 처리 |
  | logout | 204 | 정상 |
  | 토큰 없이 `/me`, `/admin/stats` | 401 `UNAUTHENTICATED` | 로그인 필요 |
  | 위조 토큰 `/me` | 401 `TOKEN_EXPIRED` | refresh 1회 후 게스트 재요청 |
- 2026-11-19 로그인 성공 이후 API 대조 (관리자 계정): 모두 client 타입·처리와 일치
  | 항목 | 결과 |
  |---|---|
  | 로그인 응답 | `AuthResponse { accessToken, expiresIn: 900, user }`, `user.role=ADMIN` |
  | refresh 쿠키 | `df_rt; Path=/api/auth; Max-Age=1209600; HttpOnly; SameSite=Strict; Secure` |
  | refresh | 쿠키만으로 `AuthResponse` 재발급 |
  | A-01 | `/admin/stats`, `/admin/sources`, `?status=ERROR` 형태 일치 (활성 36곳) |
  | A-02 | 상세(`AdminSource`), 이력(`CrawlRun`) 형태 일치, 오류 상태 아닌 소스 재개 409 `SOURCE_NOT_IN_ERROR` |
  | A-03 | 검증 실패 `valid=false + reason`, 기존 피드 `valid=true + duplicated=true`, 등록 입력 오류 400 `fieldErrors`(name·siteUrl·feedUrl·crawlIntervalMin → 폼 필드명과 일치) |
  | A-04 | 태그 목록 형태 일치, 중복 추가 409 `TAG_DUPLICATED`, 없는 작업 404 |
- 데이터를 바꾸는 동작(등록·수정·비활성화·즉시 수집·재태깅 실행)은 실서버 데이터 보호를 위해 호출하지 않음. mock 테스트로만 확인
- 브라우저 화면 확인은 못 함 (이 세션에서 브라우저 도구 사용 불가). 사용자 확인 필요
- 발견 이슈: 관리자 계정이 `onboardingCompleted=false`라 로그인 후 온보딩으로 이동함 → `docs/discussions/006-admin-onboarding-redirect.md` (decided, server 반영 후 로그인 응답 `onboardingCompleted=true` 확인)
- 2026-11-19 M2 공개 API 대조 (`:3000`): client 처리와 일치
  | 항목 | 결과 |
  |---|---|
  | `/posts` | `{ items, nextCursor }`, 게스트 응답에 `isBookmarked`·`isRead` 없음, 회원 응답에 포함. 커서 다음 페이지 중복 없음 |
  | 필터 | `sourceType=PERSONAL` 결과 전부 PERSONAL. `tagIds` 11개 → 400 `fieldErrors.tagIds` (client는 10개로 자름) |
  | 커서 오류 | 400 `INVALID_CURSOR` |
  | `/tags`, `/sources` | `Tag`(slug·category 포함), 소스 36곳 |
  | `/posts/popular` | DAY 0건, WEEK 13건, MONTH 20건. 잘못된 period → 400 |
  | `/posts/{id}/views` | 게스트·회원 204, 회원은 이후 `/posts`에서 `isRead=true`. 없는 글 404, 위조 토큰 401 `TOKEN_EXPIRED` |
  | `df_vid` 쿠키 | `Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure` |
- 발견 사항
  - 인기 글에 조회수 0인 글이 순위를 채움 → `docs/discussions/008-popular-zero-views.md` (decided A, server 반영 후 재확인: DAY 0건 · WEEK 1건 · MONTH 1건, 전부 조회수 1 이상)
  - 북마크 API(`PUT /me/bookmarks/{id}`)는 M4라 아직 404. 회원이 ☆를 누르면 낙관적 반영 후 실패로 되돌아감 (M4 전까지 알려진 동작)
  - 시드 소스 `logoUrl`이 전부 null이라 카드 로고 자리를 빈 칸 대신 생략하도록 바꿈
- 브라우저 화면 확인은 못 함 (이 세션에서 브라우저 도구 사용 불가)

## 진행 현황
- [x] 스캐폴딩, onyx-ui 연결, 라우트·가드·레이아웃
- [x] S-01 홈 피드: 카드, 태그·소스·유형 필터(URL 동기화), 무한 스크롤, 스켈레톤·빈 결과·오류 상태, 북마크 낙관적 토글, 조회 기록(keepalive), 게스트 로그인 유도 모달
- [x] S-05 로그인 (관리자 접근용으로 M1에 앞당김)
- [ ] S-06 회원가입, S-07 온보딩
- [x] S-03 인기, S-01 실서버 API 연동 확인 (M2)
- [x] S-04 검색 (mock 기준, 실서버 `/search` 구현 대기)
- [ ] S-02 추천
- [ ] S-08~S-10 회원 화면
- [x] A-01~A-04 관리자 화면 (M1)
- [x] openapi v1 기준 타입·mock 정렬 (구현 범위 한정, 나머지는 화면 구현 시 추가)
