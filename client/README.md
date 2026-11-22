# DevFeed client

- 담당: `client`
- 상태: MVP 완료 (M0~M6, 2026-11-19). 공개 주소 https://formulous.org/dev-feed/ (2026-11-22 `/portfolio/`에서 변경, `docs/discussions/028`). S-01 홈 피드, S-03 인기 글, S-04 검색, S-05 로그인, S-06 가입, S-07 온보딩, S-08 북마크, S-09 읽은 기록, S-10 설정·탈퇴, S-02 추천(M5), A-01~A-04 관리자 화면 동작
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
| `/tech` (`?field=`) | S-01 HomePage (기술 뉴스 > 최신) | - | AppLayout + FilterLayout |
| `/tech/for-you` | S-02 ForYouPage (기술 뉴스 > 추천) | RequireAuth | AppLayout + ProfileRail |
| `/tech/popular` (`?period=&field=`) | S-03 PopularPage (기술 뉴스 > 인기) | - | AppLayout + ProfileRail |
| `/tech/comments` (`?period=&field=`) | PopularPage `sort=COMMENTS` (기술 뉴스 > 댓글순, 035) | - | AppLayout + ProfileRail |
| `/security` (`?region=&sourceIds=`) | S-14 SecurityNewsPage (보안 뉴스 > 최신) | - | AppLayout |
| `/security/popular` (`?period=&region=`) | S-15 SecurityPopularPage (보안 뉴스 > 인기, 031) | - | AppLayout + ProfileRail |
| `/community` (`?category=`) | S-16 CommunityPage (커뮤니티 > 최신, 032) | - | AppLayout + ProfileRail |
| `/community/popular` (`?period=&category=`) | S-16 CommunityPopularPage (커뮤니티 > 인기) | - | AppLayout + ProfileRail |
| `/community/comments`·`/community/likes` (`?period=&category=`) | CommunityPopularPage `sort=COMMENTS|LIKES` (댓글순·좋아요순, 035) | - | AppLayout + ProfileRail |
| `/community/posts/:id` | S-17 CommunityPostPage (lazy) | - | AppLayout |
| `/community/new` (`?category=`) | S-18 CommunityNewPage (lazy) | RequireAuth | AppLayout |
| `/community/posts/:id/edit` | S-18 CommunityEditPage (lazy) | RequireAuth | AppLayout |
| `/`·`/for-you`·`/popular` | 옛 주소: `/tech`·`/tech/for-you`·`/tech/popular`로 쿼리 유지 `replace` 이동 (031) | - | - |
| `/company`·`/personal` | 예전 주소 호환: `/tech?sourceType=COMPANY|PERSONAL`로 `replace` 이동 (다른 쿼리 유지, 023) | - | - |
| `/search?q=` | S-04 SearchPage | - | AppLayout + FilterLayout |
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
| `/admin/reports` | A-05 ReportsPage (신고 관리, 032) | RequireAdmin | AdminLayout (lazy) |
| `*` | NotFoundPage | - | AppLayout |

- RequireAuth: 비로그인 시 `/login?redirect=<현재경로>`로 이동, 로그인 후 복귀 (S-05 "원래 보던 화면으로 복귀")
- 관리자 화면은 `React.lazy`로 별도 청크 분리 → 일반 사용자 번들에서 제외

## 디렉터리 구조
```
client/src/
  main.tsx            dev에서 MSW worker 시작 후 렌더링
  App.tsx             라우트 정의 (관리자는 lazy 청크)
  Providers.tsx       QueryClient → AuthProvider → LoginPromptProvider
  api/                http.ts(fetch 래퍼·TOKEN_EXPIRED 재시도), types.ts, posts.ts, search.ts, recommend.ts, auth.ts, me.ts, admin.ts
  auth/               AuthProvider.tsx, LoginPromptProvider.tsx, guards.tsx(RequireAuth·RequireAdmin·GuestOnly)
  components/         layout/(AppHeader·AppLayout·AuthLayout), post/(PostCard·Skeleton), common/(Modal·ConfirmModal·Toast·FieldError·Chip·Highlight·Pagination·EmptyState·ErrorState), filters/CheckList(홈·검색 사이드바 공용)
  features/           feed/(HomePage·FeedSidebar·ActiveFilterChips·queries), popular/PopularPage, recommend/(ForYouPage·reasons), search/(SearchPage·SearchSidebar), auth/(LoginPage·SignupPage),
                      me/(OnboardingPage·TagPicker·BookmarksPage·HistoryPage·SettingsPage·queries), info/PrivacyPage,
                      admin/(AdminRoutes·AdminDashboardPage·SourceDetailPage·SourceFormPage·TagDictionaryPage·TagFormModal·StatusBadge·queries),
                      common/NotFound
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

## 테마·디자인 (`docs/discussions/022`)
- 무채색 라이트·다크 두 벌. 색 값은 `src/theme.css`에 있음: `:root[data-color-scheme='light'|'dark']`가 onyx-ui 토큰(`--color-bg-*`·`--color-text-*`·`--color-border`·`--color-primary*`)을 덮어씀. 그래서 onyx-ui는 고치지 않았음
- client 전용 토큰: `hover`·`subtle(-strong)`·`input`·`inverse`/`on-inverse`(반전 버튼·선택 칩)·`danger`·`success`·`warn`·`hot`(인기 배지)·`overlay`·`line-strong`·`shadow-pop`. 화면 코드에 `slate-*`·`white`·`red-*` 같은 고정 색은 쓰지 않음
- 대비 (WCAG): 본문 16.8~17.1, 보조 글자 7.1~7.9, 흐린 글자 3.6~4.1, 배지·오류 글자 4.9 이상 (라이트·다크 모두)
- 전환: `index.html` `<head>`의 인라인 스크립트가 렌더 전에 `data-color-scheme`와 `theme-color`를 정함 (첫 화면 깜빡임 없음). 저장값(`localStorage` `devfeed-color-scheme`)이 있으면 그 값, 없으면 `prefers-color-scheme`
  - `lib/colorScheme.ts` `useColorScheme`: 버튼으로 전환하면 즉시 적용하고 저장함. 시스템 설정 변경은 저장값이 없을 때만 따라감
  - `ThemeToggle`(해·달 아이콘): 헤더 로그인 왼쪽, 로그인·가입 화면 오른쪽 위
- 레이아웃: 얇은 sticky 헤더(로고·테마·로그인 알약) → `PageHero`(최신·추천·인기·기업·개인·보안 뉴스·검색 화면에만 표시: 큰 제목 28/40px + 오른쪽 알약 검색창(모바일은 제목 위 전체 폭) + 글자 탭) → 1px 선 → 본문
  - 내 정보·관리자·개인정보 화면에는 hero가 없음. 대신 헤더에 검색 아이콘(`/search`로 이동)이 있음
- 글 목록: 카드 상자 없이 `divide-y` 구분선 목록. 마우스를 올리면 행 배경이 아주 옅게 바뀜. 추천 이유는 `PostCard kicker`로 행 안에 넣음. 보안 뉴스 날짜 구분은 점과 날짜
- 사이드바: 상자 없이 작은 보조색 섹션 제목 사용. 선택 칩·주요 버튼·페이지 번호는 반전색 알약, 세그먼트는 얇은 테두리 트랙
- 입력: onyx `TextField` 대신 `components/common/TextInput`을 씀 (className으로 `bg-input`·`border-line`을 덮어씀)
- 파비콘은 `#18181b`(진회색). `public/og.png`(1200×630, 라이트 무채색: 글자 로고·제목·글자 탭·구분선 목록)는 `npm run og`(`scripts/og.mjs`, Playwright)로 다시 만듦
- 캡처: `npm run capture`(라이트), `SCHEME=dark npm run capture`(다크, `screenshots/dark/`)

## 상태 관리 원칙
- 서버 데이터는 모두 React Query 캐시. 컴포넌트 로컬 상태로 복사하지 않음
- 필터·검색어·정렬·페이지·인기 기간은 URL 쿼리가 단일 출처
- 액세스 토큰은 메모리(Context)에만 보관, 리프레시 토큰은 httpOnly 쿠키 가정 → 새로고침 시 `/auth/refresh`로 복구
- 401 응답 시 1회 refresh 후 재시도, 동시 요청은 refresh 1번만 수행 (단일 Promise 공유)
- 북마크 토글: `onMutate`에서 피드·북마크·검색 캐시의 해당 글 `isBookmarked`를 즉시 반영, 실패 시 롤백

## 상단 탭·분야·보안 뉴스 (M7, `docs/discussions/021`)
- 1단 탭 `components/layout/FeedTabs.tsx`: 최신·추천·인기·보안 뉴스 (023: 기업·개인 탭 삭제 → 사이드바 `소스 유형`으로만 구분)
  - `추천`은 `status === 'member'`일 때만 그림. 게스트는 3개, 로그인 상태를 확인하는 중(`loading`)에는 그리지 않아 깜빡이지 않음
  - 글자 탭(022): 15px, 선택 = 기본 글자색·굵게, 나머지 = 보조색. 테두리·배경·밑줄 없음, 마우스를 올리면 글자만 진해짐
  - 포커스 링은 `:focus-visible`(키보드)에서만 표시
  - 1280px 한 줄, 좁은 폭은 가로 스크롤 + 양끝 흐림, 활성 탭 자동 스크롤(부드럽게)
  - 탭 이동 시 분야(`?field=`)는 유지, 태그·소스 필터는 초기화
- 2단 분야 탭 `FieldTabs`: 13px 글자 탭, `·`으로 구분하고 1단과 같은 색 규칙. 항목: 전체·BE·FE·AI·Data·Infra·Mobile·Security (023 영어 표기, `lib/fields.ts` `label`/`name`). BE·FE는 `aria-label`·`title`에 풀네임(Backend·Frontend). URL `?field=backend`·API `field=BACKEND` 그대로
  - 최신·인기·기업·개인에서만 보임. 잘못된 `field` 값은 전체로 해석해 요청에 넣지 않음 (서버는 400)
  - 위치: 1단 탭 아래 1px 구분선 밑, 본문(`main`) 맨 위 줄 (022 후속). 구분선은 탭 화면 6개 모두 1단 탭 바로 아래이고, 분야 탭과 본문 사이는 여백으로만 나눔. 스크롤하면 사라짐. sticky 헤더는 56px라 사이드바 높이에 여유가 있음 (1280×720 최대 선택에서도 사이드바 스크롤 없음)
  - sticky 헤더 높이는 `--header-h` CSS 변수로 측정해 사이드바 `top`·`max-height`에 씀
- 태그 분류 표시(023): `lib/categories.ts` `categoryLabel`이 한글 분류 값을 영어(Backend·Frontend·Database·Cloud 등)로 바꿔 보여줌. S-12 분류 탭, 온보딩·설정 태그 고르기, 관리자 태그 사전에 씀. `문화`·`기타`는 한글 그대로
  - dba가 DB 분류 값을 영어로 바꾸면 영어 값은 그대로 통과함. 전환이 끝나면 이 매핑은 지워도 됨
- 보안 뉴스(S-14) `features/security/`: `GET /security-news` 커서 무한 스크롤, 날짜 구분선(오늘·어제·M월 D일), `[전체|국내|해외]`(`?region=domestic|overseas`), 출처 칩 사이드바(`GET /security-news/sources`, 모바일은 S-12 시트)
  - 카드는 `PostCard` `badges="new"`·`summaryLines={2}`, 썸네일 없음
- 관리자: A-01 종류 필터(`?kind=`)·종류 열, A-02 종류·지역 표시, A-03 등록 시 종류 선택(보안 뉴스면 유형 대신 지역), 수정 시 종류 읽기 전용
- 공개 빌드 스위치: `VITE_HIDE_M7=true npm run build:web`이면 보안 뉴스 탭·분야 탭을 숨기고 `field`·`kind`·`region`을 요청에 넣지 않음 (`lib/features.ts`). 서버가 M7 API를 배포하기 전 공개 페이지용. 기본은 노출
- mock: 보안 뉴스 출처 6곳·기사 30건, 분야는 태그 `category`로 거름, 관리자 소스 목록에 보안 뉴스 6곳

## 기술 뉴스·보안 뉴스 2탭 + 내부 탭 (F-015·F-072, M11, `docs/discussions/031`)
- 1단 탭(`FeedTabs`, 글자 탭): 기술 뉴스(`/tech`)·보안 뉴스(`/security`). 내부 탭 화면에서도 해당 1단 탭이 선택됨. hero 제목 = 1단 탭 이름. 1단 탭 이동은 각 탭의 최신으로
- 내부 탭(`SectionTabs`, 본문 맨 위): 연한 트랙 + 선택 칸 흰 배경·테두리 세그먼트(13px). 기술 = 최신·추천·인기, 보안 = 최신·인기. 그 아래 분야 탭(기술 최신·인기만)
  - 내부 탭 이동 시 기술은 `field`만 유지(태그·소스 필터 초기화), 보안은 `region`·`sourceIds` 유지
  - 비회원 추천: 링크 대신 버튼 → 로그인 유도 모달("추천 글을 보려면 로그인이 필요해요"), 이동 없음. `/tech/for-you` 직접 진입은 `/login?redirect=`
- 주소·기본 이동처: `lib/routes.ts` `PATHS`·`HOME`(`/tech`). 로그인 후 기본·로그아웃·탈퇴 → `/tech`, 온보딩 완료 → `/tech/for-you`
- 보안 인기(S-15) `features/security/SecurityPopularPage.tsx`: `GET /security-news/popular?period=&region=` → `{ items: PopularPost[] }` 상위 20건. 지역 `[전체|국내|해외]` + 기간 `[24시간|7일|30일]`, 출처 선택은 적용 안 함(요청에 안 보냄, URL에는 남겨 최신으로 돌아갈 때 유지). 순위·조회수, 인기 배지 없음, 요약 2줄. 빈 결과 → "최신 보안 뉴스 보기"
- 기간 선택·순위 목록은 `components/post/RankedPosts.tsx`(`PeriodPicker`·`RankedPosts`)로 빼서 기술·보안 인기가 같이 씀

## 인기 글 (S-03, M2)
- 기간 탭 24시간 / 7일 / 30일 (`period=DAY|WEEK|MONTH`, 롤링 윈도우). 기본 7일이고 기본값이면 URL에서 `period`를 뺌
- 순위 1~20, 카드 하단에 조회수. 상위 3위는 강조색
- 조회수 1 이상인 글만 순위에 오름 (`docs/discussions/008` 결정). 결과가 없으면 빈 화면 + 최신 피드(S-01) 링크
- 북마크·읽음 즉시 반영은 무한 스크롤 캐시(`pages`)와 단일 목록 캐시(`items`) 모두 처리 (`hooks/usePostActions.ts`)

## 추천 피드 (S-02, M5)
- 상단: "나를 위한 추천" + 관심 태그 + [편집](설정). 관심 태그가 없으면 [관심 태그 고르기] → `/onboarding/tags?redirect=/for-you`
- `fallback=true`면 안내 배너 + 온보딩 이동 버튼. 후보 부족으로 섞인 `POPULAR` 카드는 카드별 이유로만 구분 (`docs/discussions/013`)
- 카드 위 "추천 이유" 한 줄. 이유 구조(`Reason`)를 client가 문구로 바꿈 (`features/recommend/reasons.ts`)
- 무한 스크롤. 카드 클릭 시 그 카드가 실린 페이지의 `recommendationId`를 조회 기록 본문에 전송 (클릭률)
- 다음 페이지가 `INVALID_CURSOR`(스냅샷 10분 만료·서버 재시작)면 추천 쿼리를 초기화해 첫 페이지부터 다시 받고 토스트 안내
- 관심 태그를 저장하면(온보딩·설정) 추천 캐시를 지워 새 스냅샷을 받음
- 결과가 없으면 빈 화면 + 최신 피드 링크

## 회원·개인화 (S-06~S-10, M4)
- 가입: 이메일·비밀번호(8~64자, 영문·숫자 포함, 공백·한글 불가)·확인·닉네임(2~20자). 클라이언트 검증 + 서버 `fieldErrors`, `EMAIL_DUPLICATED`는 이메일 필드 아래 표시. 가입 즉시 로그인 → 온보딩
- 온보딩: 분류 탭(카테고리 null은 "기타")·검색·태그 칩, 3~10개. 완료(`PUT /me/interest-tags`) 또는 건너뛰기(`POST /me/onboarding/complete`) 후 `redirect` 또는 `/for-you`
- 북마크: 총 건수(`total`), 태그 필터, 무한 스크롤, 카드 하단 저장일. 다른 화면에서 북마크를 바꾸면 비활성 상태인 북마크 목록 캐시만 무효화 (보고 있는 목록에선 해제한 글이 남아 다시 누를 수 있음)
- 북마크 실패는 되돌리고 토스트로 안내 (`BOOKMARK_LIMIT_EXCEEDED`는 5,000개 안내)
- 읽은 기록: 로컬 날짜별 묶음, 개별 삭제, 전체 삭제(확인 모달). 원문을 열면 기록 캐시 무효화
- 설정: 닉네임 변경(헤더에 즉시 반영), 관심 태그 칩 ✕(3개면 비활성 + "최소 3개 필요")·추가 모달, 로그아웃, 탈퇴(삭제 데이터 안내 + 비밀번호 재입력, `PASSWORD_MISMATCH` 안내)
- 직접 로그아웃·탈퇴하면 회원 화면에 있어도 `/login`이 아니라 홈으로 이동 (`signedOutByUser`). 토큰 만료로 세션을 잃은 경우는 기존대로 `/login?redirect=`
- `Modal`은 `onClose`가 바뀌어도 포커스를 다시 옮기지 않음 (입력 중 부모가 다시 렌더링될 때 두 번째 글자부터 입력이 사라지던 문제 수정)
- `Modal`은 제목·닫기 줄 고정, 본문만 스크롤(최대 높이 `100dvh - 2rem`). 너비 `size` 옵션 `sm`(기본 384px)·`md`(448px) (030)

## 검색 (S-04, M3)
- 검색어·태그·소스·기간·정렬·페이지가 모두 URL 쿼리. 기본값(`period=ALL`, `sort=RELEVANCE`, `page=1`)은 URL에서 뺌
- 필터·정렬이 바뀌면 page를 1로 되돌림. 페이지 이동 중에는 이전 결과를 흐리게 유지(`keepPreviousData`)
- 페이지 번호는 최대 50 (명세 상한, 상위 1,000건). `totalCapped=true`면 "1,000건 이상" 표시 + 마지막 페이지에서 상한 안내 (`docs/discussions/010` 결정). 필드가 없으면 false 취급
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

## 화면 문구 말투 (024)
- 화면에 보이는 문장(빈 상태·오류·안내·토스트·검증·`<title>`·메타 설명·og 이미지)은 해요체로 씀. 버튼·라벨·탭·상태값 같은 짧은 명사는 그대로 둠. README·커밋은 음슴체
- 서버 오류 메시지는 `errorMessage`로 그대로 보여 줌 (server가 해요체로 바꿨음). 분기는 메시지 문자열이 아니라 `code`로만 함

## 로그인·가입 화면과 패스키 (S-05·S-06·F-034, M9, `docs/discussions/027`)
- `AuthLayout`: 왼쪽 로고·오른쪽 테마 버튼만, 탭·검색·푸터 없음. 화면 가운데 340px 한 줄, 상단 방사형 빛(`--auth-glow`, 다크에서만 눈에 띔), 들어올 때 180ms 떠오름(`prefers-reduced-motion`이면 생략). 하단 "개인정보 안내" 링크 하나
  - 공통 부품 `components/auth/AuthPanel.tsx`: `AuthPanel`(로고+제목), `AuthButton`(44px, 모서리 8px), `AuthInput`(44px, 자리 표시 문구 라벨, 비밀번호 보기 버튼), `AuthError`
- 로그인: 패스키 사용 가능하면 [패스키로 로그인]·[이메일로 계속하기] → 이메일 입력 상태(`autocomplete="username webauthn"` + 자동완성 조건부 요청, 화면을 떠나면 취소) ↔ "다른 방법으로 로그인". 사용 불가면 처음부터 이메일 입력
  - 패스키 취소(`NotAllowedError`·중단)는 조용히 원래 상태, `PASSKEY_NOT_FOUND`는 "이 패스키로 가입된 계정을 찾을 수 없어요"
- 가입: 비밀번호 확인칸 없앰(보기 버튼으로 대체). 가입 직후에만 `/onboarding/passkey`([패스키 만들기]·[나중에]) → 관심 태그 온보딩. 일반 로그인에는 이 단계 없음 (`lib/passkey.ts` `passkeyOffer`)
- 설정 `PasskeySection`: 목록(최근 만든 순, 만든 날·마지막 사용), 추가(이름 = `deviceName()` 예: `Mac Chrome`), 이름 바꾸기(1~40자), 삭제(확인 모달), 10개면 추가 막음
- WebAuthn은 `@simplewebauthn/browser` 13. API는 `api/passkeys.ts` (`/auth/passkeys/login/options`·`/auth/passkeys/login`·`/me/passkeys/registration/options`·`/me/passkeys`)
- **사용 가능 조건** = 빌드 플래그 `VITE_PASSKEY !== 'false'` + `browserSupportsWebAuthn()`. 2026-11-22 server 배포·운영 RP 설정 후 `build:web`에서도 켬. 끄려면 `VITE_PASSKEY=false`로 빌드 (패스키 버튼·가입 후 단계·설정 섹션·개인정보 "패스키" 항목이 숨음)
- 실서버 확인(2026-11-22, formulous.org, Playwright CDP 가상 인증기, 확인용 계정 가입→탈퇴): 가입 → 패스키 만들기(`rpId` formulous.org, resident key) → 로그아웃 → 패스키 로그인 → `redirect` 복귀, 서명 횟수 1→2, 새로고침 후 로그인 유지, 설정 "마지막 사용 방금 전"·이름 바꾸기·삭제, 삭제한 패스키 로그인 → "이 패스키로 가입된 계정을 찾을 수 없어요", 페이지 오류 0
- mock `mocks/passkeys.ts` (서명 검증 없이 credential id로 회원을 찾음). 실제 브라우저 흐름은 Playwright CDP 가상 인증기로 확인 (가입 → 패스키 만들기 → 로그아웃 → 패스키 로그인 → 원래 화면)

## 좋아요·댓글 (F-080·F-081, M8, `docs/discussions/026`)
- 반응 줄 `components/post/ReactionBar.tsx`는 `PostCard` 태그 줄 오른쪽에 붙음 → 최신·추천·인기·검색·북마크·보안 뉴스에 공통 적용, 읽은 기록은 `reactions={false}`
  - 목록 응답에 `likeCount`가 없으면 반응 줄을 그리지 않음 → server 배포 전 `build:web`에서는 자동으로 숨고, 필드가 오면 바로 보임 (별도 플래그 없음). mock은 필드를 채움
  - 버튼은 원문 링크 덮개(`a::after`) 위 `z-10`, 댓글 영역은 `article` 밖 형제로 펼쳐서 원문 이동이 일어나지 않음
- 좋아요 `useToggleLike`(`hooks/usePostActions.ts`): 낙관적 토글 + 글별 직렬화(진행 중 요청이 있으면 마지막 의도만 이어서 보냄), 실패 시 연타 시작 전 값으로 되돌림. 게스트는 로그인 안내
- 댓글 `components/comments/`: 펼칠 때 `['comments', postId]` 무한 쿼리로 처음 불러옴. 작성·수정·삭제·숨김·답글 더보기는 응답으로 캐시를 직접 고치고(`commentCache.ts`), 응답의 `commentCount`로 목록 항목 수를 맞춤
  - 작성·숨김·숨김 해제 응답은 `{ comment, commentCount }`. 삭제 응답 `removed`·`parentRemoved`로 자리 표시("삭제된 댓글이에요")를 남길지 부모까지 지울지 정함
  - 메뉴: 내 VISIBLE 댓글은 수정·삭제, 숨겨진 내 댓글(`mine`+HIDDEN)은 삭제만. 답글 달기는 VISIBLE 최상위 댓글에만. "답글 N개 더보기"의 N = `replyCount`(VISIBLE+HIDDEN) − 받은 답글 수
  - 내용은 텍스트 노드 + `whitespace-pre-wrap`으로만 렌더 (HTML 해석 없음). 입력은 1,000자 카운터, 앞뒤 공백 제거 후 빈 값이면 등록 비활성, `Ctrl/⌘+Enter` 등록
- mock: `mocks/reactions.ts` (첫 글에 댓글 25개·답글 5개·삭제 자리·숨김·`<script>` 문구, 좋아요 1,234). 캡처 `S-01-comments`(360·1280, 관리자)

## 프로필 카드·활동 등급 (F-082·F-083, M10, `docs/discussions/029`)
- 위치: 최신·검색(`FilterLayout`)·보안 뉴스 좌측 열 맨 위, 좌측 열이 없던 인기·추천은 `ProfileRail`(256px 좌측 열 + 본문)로 감쌈. `lg` 미만은 숨기고 헤더 프로필 메뉴 맨 위에 아바타·닉네임·등급
- `components/profile/`: `ProfileCard`(회원·게스트·로딩·오류), `Avatar`(닉네임 첫 글자, 무채색 6단계, 글자 대비 4.5:1 이상 테스트), `GradeBadge`, `GradeGuideModal`(등급표 + 점수 규칙 2줄 목록, `Modal size="md"`, 030)
- 데이터: `GET /me/profile` → `{ nickname, score, grade: { level, name, minScore, nextMinScore }, stats }` (`hooks/useProfile.ts`, 키 `['me','profile']`). 다음 등급 이름은 `lib/grades.ts` 상수(level+1)에서 찾음. 진행 막대 = 현재 등급 시작점부터 다음 등급까지 비율
- 활동 직후 반영: 좋아요(직렬화 끝)·북마크·원문 조회(`POST /views` 응답 후)·댓글 작성/삭제/숨김·읽은 기록 삭제 뒤 `refreshProfile`로 재조회
- 댓글 작성자 옆 아바타(20px)·등급 배지 (`author.grade`)
- 1280×720 최신·검색 사이드바(카드+필터) 617px로 스크롤 없이 들어옴
- mock: `mocks/profile.ts` (읽기 같은 글 1회·하루 30점, 좋아요 +2, 댓글 +5 하루 10개, 기본 점수 1,200)
- 2026-11-22 server 배포·백필 후 `build:web` 배포. 실서버 확인(확인용 계정 가입→탈퇴): 원문 열기 +1·재읽기 0, 좋아요 +2·취소 회수, 댓글 +5·삭제 회수, 읽은 기록 삭제 후 점수 유지, 댓글 배지, 360px 헤더 메뉴, 1280×720 좌측 열 스크롤 없음

## 1단 탭 순서·펼침 메뉴·정렬 선택 (`docs/discussions/033`)
- 1단 탭 순서 `자유 게시판 · 기술 뉴스 · 보안 뉴스`, 화면 문구 "커뮤니티" → "자유 게시판" (주소 `/community/...` 그대로, `/`는 `/tech`)
- 데스크톱(`HOVER_MENU_MEDIA` = `(min-width: 1024px) and (hover: hover)`): 1단 탭에 마우스를 올리거나 포커스하면 하위 탭 메뉴(`role="menu"`)가 탭 아래 겹쳐 뜸. 떠날 때 150ms 지연 후 닫힘, ↓로 메뉴 진입·↑↓·Home/End 이동·Enter 선택·Esc 닫고 탭으로 복귀. 현재 하위 탭은 ✓ 표시. 비회원 추천은 로그인 안내 모달
- 데스크톱은 하위 탭 토글 그룹 대신 목록 위 줄 오른쪽 `정렬` 선택(`최신순·추천순·인기순`, 자유 게시판·보안 뉴스는 `최신순·인기순`). 같은 줄 왼쪽에 분야·말머리 글자 탭, 자유 게시판은 `글쓰기`가 정렬 왼쪽. 바꾸면 하위 탭 주소로 이동(유지 규칙 031·032 그대로)
- 모바일·터치(위 조건 아님): 지금 토글 그룹(`SectionTabs`) 그대로
- 테스트: `tests/setup.ts`가 `HOVER_MENU_MEDIA`를 기본 false로 두고, `tests/hoverMenu.test.tsx`에서 켜서 확인

## 정렬 글자 탭·댓글순·좋아요순 (`docs/discussions/035`)
- 033의 `[최신순 ▾]` 선택 메뉴를 없애고 목록 위 줄 오른쪽에 정렬 글자 탭(`SortTabs`, `data-testid="sort-tabs"`, 분야 탭과 같은 크기). 자유 게시판 `글쓰기`는 정렬 탭 오른쪽
- 항목: 자유 게시판 `최신·인기·댓글·좋아요`, 기술 뉴스 `최신·추천·인기·댓글`, 보안 뉴스 `최신·인기`. hover 메뉴·모바일 토글도 같은 항목 (`FeedTabs.tsx` `ALL_SECTIONS`). 모바일 토글은 넘치면 가로 스크롤
- 기간: `ranked` 탭(인기·댓글·좋아요) 사이 이동 때만 `period`를 넘김 (`tabHref`), 최신·추천으로 가면 버림
- API: 기존 인기 API에 `sort` (`/posts/popular?sort=VIEWS|COMMENTS`, `/community/popular?sort=SCORE|COMMENTS|LIKES`, 기본값이면 생략). 순위 카드는 `RankedPosts` `metric` → `PostCard`·`ReactionBar` `emphasize`로 반응 줄의 해당 수치만 굵게 (인기순은 `조회 N` 메타 유지)

## 자유 게시판 (커뮤니티, F-090~F-094, M12, `docs/discussions/032`)
- 1단 탭 3개(033 이후 자유 게시판·기술 뉴스·보안 뉴스). 커뮤니티 내부 탭 `[최신 | 인기]` + 말머리 글자 탭(`?category=question|discussion|share`, 탭 이동 시 유지) + 오른쪽 `글쓰기`(비회원은 로그인 안내 모달). 좌측 열은 프로필 카드만 (목록 API에 태그 필터 없음)
- 카드: `PostCard`가 `kind === 'COMMUNITY'`면 출처 대신 말머리·`해결됨`·작성자(아바타·닉네임·등급, 640px 미만은 등급 숨김)를 보이고 제목·💬는 상세(`/community/posts/:id`)로 이동. 북마크·읽은 기록 목록도 `kind`로 같은 분기
- 상세(S-17): 본문 마크다운, 좋아요·북마크, 댓글 기본 펼침(`CommentSection flat`). 질문 작성자에게 최상위 남의 댓글 `채택`/`채택 취소`, 채택 댓글 맨 위 고정·삭제 버튼 없음. 작성자 수정·삭제, 관리자 삭제·숨김·해제, 회원 `신고`(글·모든 댓글, 신고 후 `신고함`). 숨김 글은 안내 띠, 삭제 자리(댓글 있음)는 "삭제된 글이에요" + 댓글. 404는 "글을 찾을 수 없어요". 열람 시 `POST /posts/{id}/views` 1회
- 작성·수정(S-18): 말머리·제목(2~100)·본문(10~20,000, `textarea` 모노 글꼴)·태그(설정의 `TagPicker`, 최대 5). `[작성 | 미리보기]`는 상세와 같은 렌더러. Tab/Shift+Tab 들여쓰기(여러 줄 지원), Esc 후 Tab은 포커스 이동. 수정은 바뀐 필드만 PATCH
  - 작성 제한: `GET /community/write-status`로 먼저 확인해 막히면 버튼 대신 사유·남은 시간(가입 24시간·하루 5개·60초). 429 `POST_WRITE_LIMITED`도 같은 안내로 바꾸고 쓰던 내용 유지. 시간이 지나면 다시 조회
  - 임시 저장: `localStorage` `devfeed:community-draft:<회원 id>:<new|글 id>`에 1초 디바운스, 다시 열면 "임시 저장한 내용을 불러왔어요 [버리기]", 올리기 성공 시 삭제. 새로고침·탭 닫기는 `beforeunload` 경고. 앱 안 이동은 라우터(`BrowserRouter`)가 막을 수 없어 임시 저장으로 보존 (032 pm 수용)
- 안전 렌더러(`components/markdown/`): `react-markdown` + `remark-gfm`, `rehype-raw` 없음 → 원시 HTML은 글자로만 보임. `allowedElements` 허용 목록, 링크는 `http(s)`만(`urlTransform`) + `target=_blank rel="nofollow ugc noopener noreferrer"`, 이미지 문법은 `[이미지: alt]` 글자, h1→h2·h5/h6→h4. 코드 블록은 `lowlight` + highlight.js 17개 언어(rehype 플러그인, `dangerouslySetInnerHTML` 없음), 복사 버튼. 렌더러는 `React.lazy` 별도 청크(gzip 약 80KB), 상세·작성 화면도 lazy라 첫 화면 번들 영향 없음
- 신고(`components/report/ReportModal`): 사유 스팸·욕설·비방·개인정보 노출·기타(200자). `REPORT_DUPLICATED`·`REPORT_OWN_CONTENT`·`NOT_FOUND`는 코드별 문구
- A-05 신고 관리: `[대기 | 숨김]` 탭(`state=PENDING|HIDDEN`), 대상·미리보기·사유별 수·기타 내용·상태(보임·자동 숨김·관리자 숨김), `숨김`/`문제없음`(숨김 탭은 `숨김 해제`)
- 프로필 카드 5칸(글·좋아요·댓글·읽은 글·북마크), 등급 안내에 글 +10(하루 3개분)·받은 좋아요 +1(하루 50) 2줄. 숨김 댓글 문구는 "숨겨진 댓글이에요"(신고 숨김 포함). 탈퇴 확인 창·개인정보 안내에 커뮤니티 글 처리 추가
- mock(`mocks/community.ts`, `communityStore.ts`): 시드 글 24개(질문 해결됨 5001, XSS 5004, 내 글 5007, 신고 2건 5010, 자동 숨김 5012), 작성 제한·점수 +10(하루 3개)·채택·신고 3명 자동 숨김·관리자 처리·409 `COMMUNITY_POST_CLOSED`·`COMMENT_ACCEPTED`. 로그인 mock은 `new`로 시작하는 이메일만 가입 직후 계정
- 본문 길이: 앞뒤 공백 제거 10자 이상, 원문 20,000자 이하 (server 구현 기준, 글자 수 표시도 원문 길이)
- 실서버 확인(2026-11-22, 확인용 계정 2개 가입→탈퇴): 360 라이트·다크 목록·인기·말머리 가로 넘침 0, 1단 탭 3개·제목, 비회원 글쓰기 안내, 없는 글 404 화면, 신규 계정 작성 제한 안내(버튼 없음), 미리보기 XSS 무해화·하이라이트, 새로고침 후 임시 저장 복구, 프로필 5칸, 등급 안내 2줄, 탈퇴 안내. 운영에 글이 0건이라 상세·작성·채택·신고는 pm 공개 확인으로 넘김
- 테스트 `tests/community.test.tsx` 23건 (XSS 6종 무해화, 하이라이트, 목록·말머리, 상세·채택·신고·자동 숨김, 작성·미리보기·제한 3종·429·임시 저장·Tab, 수정 PATCH 필드, A-05, 프로필 5칸, 북마크 분기)

## 좌우 광고 (F-060, `docs/discussions/025`)
- `components/ads/SideAd.tsx`, `lib/ads.ts`. 게시자 `ca-pub-1750461537555326`, 좌 `3021654585`·우 `2195210969` (반응형 `auto`), `index.html`에 `google-adsense-account` 메타
- 표시: 화면 폭 1440px 이상(`matchMedia`)이면서 상단 히어로가 있는 화면(최신·추천·인기·보안 뉴스·검색)만. `AppLayout`에서 `main` 좌우에 160px `sticky`(헤더 아래 24px) 배치, 본문 폭은 줄어듦
- 1440px 미만·그 밖의 화면은 광고 컴포넌트를 그리지 않아 스크립트 요청도 없음
- `adsbygoogle.js`는 첫 광고 마운트 때 `<head>`에 1회 추가(같은 src가 있으면 건너뜀). `push({})`는 `ins`마다 1회(`data-ad-requested`), 탭 이동 때는 `AppLayout`이 유지돼 다시 요청하지 않음
- 미게재(`data-ad-status="unfilled"`)는 CSS로 숨기고, 차단 시 높이 0이라 빈 상자 없음. 자동 광고·피드 중간 광고는 쓰지 않음 (AdSense 콘솔의 자동 광고도 꺼 둬야 함)
- S-11 개인정보 안내에 광고 쿠키 항목·Google 광고 정책/설정 링크

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
npm run build      # vite build + 빌드 결과 mock 검사(scripts/check-build.mjs)
npm test
npm run capture    # 반응형 점검·README용 스크린샷 (Playwright, 최초 1회 npx playwright install chromium)
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

## 출시 점검 (M6, `docs/discussions/014`)
- 프로덕션 빌드 mock 차단
  - mock 시작 코드는 `import.meta.env.DEV`에서만 동적 import → 번들에서 빠짐
  - `public/mockServiceWorker.js`는 빌드 결과에서 지움 (`vite.config.ts` `drop-mock-worker` 플러그인)
  - `build`·`build:web` 마지막에 `scripts/check-build.mjs`가 워커 파일·mock 코드 문자열(`setupWorker` 등)이 없는지 검사, 있으면 실패
- 전역 에러 화면: `AppLayout`·`AuthLayout`의 `Outlet`을 `ErrorBoundary`로 감쌈 (헤더는 유지). 경로가 바뀌면 초기화
  - 재배포 직후 lazy 청크(관리자) 로드 실패면 1회 자동 새로고침 (`sessionStorage` 플래그로 무한 반복 방지), 그래도 실패하면 "새 버전이 배포됐음" 안내
- S-11 개인정보 안내(`/privacy`): 기획서 03 S-11 문구 기준 (수집 항목, 이용 목적, `df_vid` 쿠키, 탈퇴 즉시 삭제 + 백업 최대 14일, 추천 기록 익명화, 원문 저작권)
  - 진입: 공통 푸터(`AppFooter`, `AppLayout`·`AuthLayout` 하단), 회원가입 화면 하단 링크
  - onyx `SiteFooter`는 formulous 링크(소개·문의 등)가 고정돼 있어 쓰지 않음
- 공개 전환(2026-11-19, `https://formulous.org/portfolio/`, nginx `noindex` 유지)에 맞춰 `index.html`에 meta description·OG·Twitter 카드, `public/favicon.svg`, `public/og.png`(S-01 1280px 캡처) 추가. OG URL은 공개 주소 절대 경로로 고정
- 필터 요약 패널 + 선택 창 (`docs/discussions/017`, 018·019, 2026-11-20). 016의 체크박스 목록·섹션 내부 스크롤·모바일 드로어는 폐지
  - 홈·검색이 `components/filters/`를 공유: `FilterLayout`(배치·창 상태), `FilterPanel`(사이드바), `ChipPickerModal`(S-12 선택 창), `Segment`, `ActiveFilterChips`, `useFilterCatalog`(태그·소스 목록 가공)
  - 화면별 차이는 `FilterBindings`(태그·소스·세그먼트·초기화)로 넘김: 홈 `useFeedFilterBindings`(소스 유형), 검색 `useSearchFilterBindings`(기간)
  - 사이드바: 인기 태그 12개 칩(글 수순) + 상위 12개 밖에서 고른 태그 3개까지 앞에(나머지 "+N개" → 선택 창), 유형·기간 세그먼트, 빠른 선택 밖에서 고른 소스 2개까지 + "+N개", 빠른 선택 소스 5개, "선택 n개 · 초기화". 칩은 누르면 바로 적용
  - 빠른 선택 소스: `recentPostCount`(최근 30일) 내림차순 → `postCount` → 이름순, 0은 제외 (019). 필드가 없으면 `postCount` 기준, 둘 다 없으면 숨김 (`pickQuickSources`)
  - 선택 창(S-12): 검색 + 분류 탭(태그 `category`, 없으면 "기타") / 유형 탭(기업·개인) + 칩 목록. 창 안 칩 목록만 스크롤. [적용]해야 URL에 반영, Esc·바깥 클릭은 버림. 열리면 검색창에 포커스, Tab 포커스 가둠. 데스크톱 가운데 창(최대 640px·80vh), 모바일 하단 전체 시트
  - 모바일: 피드 위 `[태그 ▾][유형/기간 ▾][소스 ▾]` 버튼 줄(선택 개수 표시) → 선택 창, 유형·기간은 세그먼트 시트. 고른 필터는 칩 줄(검색 화면에도 추가)
  - 사이드바 `sticky` 독립 스크롤은 낮은 화면용 안전장치로 유지, 스크롤바는 `scrollbar-thin`
  - S-08 북마크 태그 필터도 같은 선택 창 사용 (2026-11-20): [태그 ▾] 버튼 → S-12, 여러 개 OR(최대 10), URL `?tagIds=`(예전 `?tagId=` 링크도 읽음), 고른 태그는 칩 줄·초기화. 실서버 `tagIds` OR 동작 확인
  - 수용 기준 측정 (`npm run capture` + 실서버 데이터 임시 측정): 1280×720·1440×900에서 기본·최대 선택(태그 10, 소스 20) 모두 사이드바 `scrollHeight ≤ clientHeight`. 실데이터 최대 선택 처음 613/584px 넘침 → 소스 추가 표시 2개·칩 간격 4px로 줄여 567/567
- 광고(F-060)는 사용자 결정으로 제외 (`docs/discussions/016` decided). 관련 코드 없음
- 비공개 화면 `meta robots noindex` (016, 사용자가 nginx `noindex` 해제): S-05~S-10, A-01~A-04 진입 시 `RouteTitle`이 `<meta name="robots" content="noindex">`를 붙이고, 공개 화면(S-01~S-04, S-11)으로 오면 뗌
- 화면별 `<title>`: `components/layout/RouteTitle.tsx`의 경로 표 한 곳에서 관리 (예: "검색: 카프카 · DevFeed")
- 글 카드 배지 (F-014, `docs/discussions/020`): 소스 줄 시간 옆에 `NEW`(발행 24시간 이내, client 계산)·`인기`(`PostSummary.isPopular`, 7일 인기 상위 20) 최대 2개
  - `components/post/PostBadges.tsx`, `PostCard`의 `badges` prop: 기본 `all`, S-03 인기는 `new`(인기 배지 생략), S-09 기록은 `none`
  - `isPopular`가 없는 응답이면 `인기`만 생략. mock은 7일 조회수 상위 20건에 `isPopular: true`
- 반응형 점검: `npm run capture`가 dev 서버(MSW mock)를 띄워 17개 화면 × 360·768·1280px를 찍음
  - 결과: `screenshots/{폭}/{화면}.png`(전체), `.top.png`(첫 화면), `screenshots/overview-{폭}.png`(폭별 모음). git 제외
  - 가로 넘침(`scrollWidth > clientWidth`)을 자동 검사해 출력
  - 외부 이미지 요청은 막아서 결과가 매번 같음
  - 브라우저 시각을 mock 기준(2026-11-19 12:00Z)으로 고정해 `NEW` 배지가 매번 같게 찍힘
  - README용 4장(S-01·S-02·S-04·A-01, 1280px 첫 화면)은 `docs/screens/`에 복사 → 커밋
- 반응형 점검 결과 (2026-11-19): 15개 화면(S-11 포함) × 3폭 모두 가로 넘침 없음
- 반응형 점검 결과 (2026-11-20, M7): 17개 화면(S-13·S-14 추가) × 3폭 가로 넘침 없음. 1280px 탭 한 줄, 360px 마지막 탭까지 스크롤 도달·활성 탭 자동 스크롤 (`npm run capture`가 함께 출력)
  | 발견 | 폭 | 조치 |
  |---|---|---|
  | 헤더 "로그인"이 세로로 한 글자씩 접힘 | 360 | 헤더 오른쪽 영역 `shrink-0 whitespace-nowrap`, 닉네임은 8rem에서 말줄임 |
  | S-02 제목 옆 "관심 태그:" 라벨이 따로 떨어짐 | 360 | 좁은 폭에서 제목을 한 줄 전체로, 관심 태그는 다음 줄 |
  - 768px은 사이드바가 "필터" 버튼으로 접힘(의도), 관리자 표·수집 이력·태그 사전 표는 360px에서 표 안에서만 가로 스크롤(의도)

## 하위 경로 배포 (외부 확인용)
- `https://formulous.org/dev-feed/` 에서 실서버 연동 빌드를 확인함 (`docs/discussions/009`, 028에서 `/portfolio/` → `/dev-feed/`)
- `npm run build:web` → `dist-web/` (`VITE_BASE=/dev-feed/`, mock 끔). `dist-web/`는 git 제외. `check-build`가 결과에 옛 주소 `/portfolio/`가 남으면 실패시킴
- 하위 경로 처리
  - Vite `base`: `VITE_BASE` 환경변수 (기본 `/`)
  - 라우터: `BrowserRouter basename` = `BASE_URL`에서 끝 슬래시 제거
  - API: `apiUrl`이 `${BASE_URL}api` 기준 → `/dev-feed/api/...` (조회 기록 keepalive 포함)
- nginx 설정은 pm 담당. `/dev-feed/api/` → `127.0.0.1:3000/api/` 프록시, 리프레시 쿠키 경로 변환

## 실서버 확인 (M5 추천)
- 2026-11-19 `:3000`, 확인용 계정 가입 → 확인 → 탈퇴
  | 항목 | 결과 |
  |---|---|
  | 비로그인 | 401 `UNAUTHENTICATED` → client는 `RequireAuth`로 로그인 이동 |
  | 콜드 스타트 | `fallback=true`, 이유 `POPULAR` → 안내 배너 표시 조건과 일치 |
  | 관심 태그 3개 저장 후 | `fallback=false`, 이유 `INTEREST_TAG`(+`tagName`)·`POPULAR`(후보 부족 채움) 혼합, 이유 최대 1~2개 |
  | 다양성 | 같은 소스 최대 연속 2개 |
  | 후보 제외 | 응답 카드 모두 `isBookmarked`·`isRead` false |
  | 페이지네이션 | `size=5`로 4페이지 20건, 중복 없음, 페이지마다 새 `recommendationId`, 마지막 `nextCursor=null` |
  | 잘못된 커서 | 400 `INVALID_CURSOR` → client는 첫 페이지부터 재요청 |
  | 클릭 | `POST /posts/{id}/views { recommendationId }` 204, 다음 스냅샷에서 해당 글 제외(읽음) |
- 화면 동작(배너·이유 문구·재요청 토스트·클릭 시 ID 전송)은 mock 테스트로 확인. 브라우저 확인은 `build:web` 후 formulous

## 실서버 확인 (M8 좋아요·댓글, `docs/discussions/026`)
- 2026-11-21 formulous.org, 확인용 계정 가입 → 확인 → 탈퇴 (좋아요·댓글 잔존 0, 대상 글 수 원래대로)
  | 항목 | 결과 |
  |---|---|
  | 반응 줄 | 게스트 최신·인기·보안 뉴스·검색 항목 전부 표시 |
  | 게스트 | 좋아요 → 로그인 안내, 원문 탭 안 열림. 댓글 펼침 "아직 댓글이 없어요" + 로그인 안내 |
  | 좋아요 | 5번 연타 → `aria-pressed=true`·1개, 서버 `likeCount` 1 |
  | 댓글 | `<b>` 입력 글자 그대로, 앞뒤 공백 제거, 답글·수정 "(수정됨)", 답글 있는 댓글 삭제 → 자리 표시, 답글 삭제 → 부모 정리·수 0 |
  | 360 다크 | 댓글 펼침 가로 넘침 0 |
- 관리자 숨김은 관리자 계정이 필요해 사용자 확인 대상

## 실서버 확인 (M4 회원)
- 2026-11-19 `:3000`, 확인용 계정 가입 → 확인 → 탈퇴 (데이터 미잔존)
  | 항목 | 결과 |
  |---|---|
  | 가입 | 201 `AuthResponse`(`onboardingCompleted=false`), 입력 오류 400 `fieldErrors`(email·password·nickname), 중복 409 `EMAIL_DUPLICATED` |
  | 관심 태그 | 2개 저장 400 `fieldErrors.tagIds`, 3개 저장 후 `/me`에서 `hasInterestTags`·`onboardingCompleted` true |
  | 온보딩 완료 | 204 |
  | 북마크 | PUT 멱등 204, 목록 `total`·`bookmarkedAt`·`isBookmarked`, DELETE 멱등 204 |
  | 읽은 기록 | 조회 기록 후 목록에 `readAt`, 개별 삭제·전체 삭제 204 |
  | 닉네임 | 1자 400 `fieldErrors.nickname`, 변경 200 |
  | 탈퇴 | 틀린 비밀번호 403 `PASSWORD_MISMATCH`, 성공 204 → 기존 토큰 `/me` 401, 같은 계정 로그인 401 |
- 서버 비밀번호 규칙("공백·한글 불가")을 client 검증에도 맞춤

## 실서버 확인 (M3 검색)
- 2026-11-19, 개발 서버 `:3000`(글 약 2,400건)과 성능 측정 서버 `:3100`(`devfeed_perf`, 10만 건) 모두 대조
  | 항목 | `:3000` | `:3100` |
  |---|---|---|
  | "개발" 건수 | 412건, `totalCapped=false` | 1,000건, `totalCapped=true` → "1,000건 이상" |
  | 50페이지 | 0건 (412건이라 정상) | 20건 |
  | 태그 필터 | 결과 전부 해당 태그 포함 | 동일 |
  | 소스 필터 | 결과 전부 해당 소스 | 동일 |
  | 기간 1W | 결과 전부 7일 이내 | 동일 |
  | 최신순 | 발행일 내림차순 | 동일 |
  | 하이라이트 | "성능 개선" 결과 19/19건 제목·요약에 토큰 포함 | 20/20건 |
- 화면 동작은 mock 테스트로 확인 (브라우저 도구 없음). 외부 확인은 `https://formulous.org/portfolio/search?q=...`

## 진행 현황
- [x] 스캐폴딩, onyx-ui 연결, 라우트·가드·레이아웃
- [x] S-01 홈 피드: 카드, 태그·소스·유형 필터(URL 동기화), 무한 스크롤, 스켈레톤·빈 결과·오류 상태, 북마크 낙관적 토글, 조회 기록(keepalive), 게스트 로그인 유도 모달
- [x] S-05 로그인 (관리자 접근용으로 M1에 앞당김)
- [x] S-06 회원가입, S-07 온보딩 (M4)
- [x] S-03 인기, S-01 실서버 API 연동 확인 (M2)
- [x] S-04 검색 (실서버 `/search` 응답 형태·오류 대조 일치. 실서버 연동 확인 완료)
- [x] S-02 추천 (M5, 실서버 확인)
- [x] S-08~S-10 회원 화면 (M4, 실서버 확인)
- [x] A-01~A-04 관리자 화면 (M1)
- [x] S-16~S-18·A-05 커뮤니티 (032, 2026-11-22 `build:web` 배포. 실서버 게스트·신규 회원 확인, 글 작성·채택·신고는 pm 공개 확인)
- [x] openapi v1 기준 타입·mock 정렬 (구현 범위 한정, 나머지는 화면 구현 시 추가)
