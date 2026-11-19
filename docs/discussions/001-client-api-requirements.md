# 001. 화면 기준 API 요구사항 (client → server)

- 상태: open
- 제기: client
- 관련: server, pm
- 관련 문서: `docs/spec/02-features.md`, `docs/spec/03-screens.md`, `client/README.md`

## 배경
- `openapi.yaml` 작성 전에 화면(S-01~S-10, A-01~A-04)이 필요로 하는 응답 형태를 먼저 공유함
- client는 아래 가정으로 MSW mock을 만들고, 명세가 나오면 타입·mock을 명세에 맞춰 교체함

## 제안 / 한계점

### 1. 공통
- base path `/api`. dev에서는 Vite proxy로 same-origin 처리 → 쿠키 CORS 문제 회피
- 오류 형식 통일: `{ code: string, message: string, fieldErrors?: { field: string, message: string }[] }`
  - 로그인 제한(F-030)은 `code: "LOGIN_LOCKED"` + `retryAfterSec: number` 필요 (S-05 남은 시간 표시)
- 날짜는 ISO 8601 UTC 문자열

### 2. 인증 (F-030)
- 액세스 토큰: 응답 body → client가 메모리 보관, `Authorization: Bearer`
- 리프레시 토큰: **httpOnly·Secure·SameSite=Lax 쿠키** 요청. localStorage 저장은 XSS 노출 때문에 피하고 싶음
- 필요 엔드포인트: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`(쿠키만으로 동작), `POST /auth/logout`, `GET /me`
- `GET /me` 응답에 `role: "USER" | "ADMIN"`, `hasInterestTags: boolean` 포함 요청 (관리자 가드, 온보딩 분기)

### 3. 글 카드 공통 형태 (`PostSummary`)
```
id, title, summary, url(원문), thumbnailUrl|null, publishedAt,
source: { id, name, logoUrl|null, type: "COMPANY"|"PERSONAL" },
tags: { id, name }[],
isBookmarked?: boolean, isRead?: boolean   ← 회원 요청일 때만
```
- 피드·검색·인기·추천·북마크·읽은 기록이 같은 형태면 `PostCard` 하나로 재사용 가능. 화면별 추가 필드만 확장 요청
  - 인기: `viewCount`, 북마크: `bookmarkedAt`, 읽은 기록: `readAt`, 추천: `reasons`

### 4. 최신 피드 (F-010, F-011)
- `GET /posts?cursor=&limit=20&tagIds=1,2&sourceIds=3&sourceType=COMPANY`
- 응답 `{ items: PostSummary[], nextCursor: string | null }`. cursor는 불투명 문자열이면 됨
- 사이드바용: `GET /tags?q=&category=`(태그명·분류·글 수), `GET /sources`(공개 목록: id, name, logoUrl, type)

### 5. 원문 이동·조회수 (F-012)
- client는 카드 링크로 원문을 직접 열고, 동시에 `POST /posts/:id/views`를 `fetch(keepalive)`로 호출함 (리다이렉트 엔드포인트 방식은 기록 실패 시 이동이 막혀서 비선호)
- 비회원 식별자: 서버가 익명 쿠키를 발급하는 방식 선호. 안 되면 client가 UUID를 만들어 헤더(`X-Anonymous-Id`)로 보냄 — server 쪽 선택 요청
- 추천 피드에서 클릭한 경우 `{ recommendationId }`를 body로 같이 보냄 (F-042 클릭률)

### 6. 인기 글 (F-013)
- `GET /posts/popular?period=day|week|month` → `{ items: (PostSummary & { viewCount })[] }` 20건 고정, 페이지네이션 없음

### 7. 검색 (F-020~F-022)
- `GET /search?q=&tagIds=&sourceIds=&period=1w|1m|1y|all&sort=relevance|latest&page=1&size=20`
- 응답 `{ items: PostSummary[], total: number, page, size }` (S-04 "N건" 표시, 페이지 번호 UI)
- 하이라이트: **서버는 HTML을 만들지 않아도 됨.** client가 검색어 토큰으로 직접 강조함. 서버가 ngram 기준 매칭 토큰을 주고 싶으면 `matchedTerms: string[]` 정도만 있으면 충분
- 결과 0건 화면용 인기 태그: `GET /tags/popular?limit=10` 또는 `/tags?sort=postCount`

### 8. 추천 (F-042)
- `GET /recommendations?cursor=` → `{ items: (PostSummary & { reasons: Reason[] })[], nextCursor, recommendationId, fallback: boolean }`
  - `Reason = { type: "INTEREST_TAG" | "READ_HISTORY" | "BOOKMARK" | "POPULAR", tagName?: string }` 구조화 요청. 문구는 client가 만듦
  - `fallback: true`면 콜드 스타트(인기 글 대체) → S-02 안내 배너 표시
- 노출 기록은 서버가 응답 시점에 남기는 방식 제안 (client 별도 노출 API 호출 안 함). 실제 화면 노출 기준이 필요하면 의견 주셈

### 9. 회원 데이터
- 관심 태그: `GET /me/interest-tags`, `PUT /me/interest-tags { tagIds }` (3~10개 검증)
- 북마크: `PUT /me/bookmarks/:postId`, `DELETE /me/bookmarks/:postId` (멱등이어야 낙관적 UI 재시도 안전), `GET /me/bookmarks?cursor=&tagIds=` + 총 개수(S-08 "북마크 (152)")
- 읽은 기록: `GET /me/history?cursor=`, `DELETE /me/history/:postId`, `DELETE /me/history`
- 닉네임 변경: `PATCH /me { nickname }`, 탈퇴: `DELETE /me { password }`

### 10. 관리자 (F-001, F-002, F-005, F-006)
- `GET /admin/stats` (오늘 수집 수, 실패 소스 수, 활성 소스 수)
- `GET /admin/sources?status=` (상태, 마지막 성공, 7일 신규, 연속 실패)
- `GET /admin/sources/:id`, `GET /admin/sources/:id/runs?limit=50`
- `POST /admin/sources/validate { feedUrl }` → 유효 여부·최근 글 수 (A-03 [검증] 버튼, 저장 전 단독 호출)
- `POST /admin/sources`, `PATCH /admin/sources/:id`(비활성화 포함), `POST /admin/sources/:id/crawl`(즉시 수집), `POST /admin/sources/:id/resume`(오류 상태 재개)
- 태그 사전: `GET/POST/PATCH /admin/tags`, `POST /admin/tags/retag` (오래 걸리면 202 + 상태 조회 방식 희망)

## 의견

### client (1차)
- 위 형태는 화면 기준 희망안임. 스키마·성능 사정으로 다르게 가야 하면 명세에 반영하고 이유만 남겨주면 맞춤
- 특히 결정 필요한 것: (2) 리프레시 토큰 쿠키 여부, (5) 비회원 식별 방식, (8) 추천 노출 기록 시점

### server (1차)
- 공통 규칙은 `docs/api/conventions.md`에 반영함. 스키마 쪽 서버 요구사항은 `002-server-schema-requirements.md` (001 번호가 겹쳐 server 문서를 002로 바꿈)
- 수용함
  - (1) base path `/api`, 오류 `fieldErrors`, `LOGIN_LOCKED` + `retryAfterSec`, enum UPPER_SNAKE (`USER`/`ADMIN`, `COMPANY`/`PERSONAL`)
  - (3) `PostSummary` 단일 형태 + 화면별 확장 필드 (`viewCount`, `bookmarkedAt`, `readAt`, `reasons`). `isBookmarked`/`isRead`는 회원 요청에만 포함
  - (4) 쿼리 형태 그대로. 단 크기 파라미터는 `limit` 대신 `size`로 통일 (검색과 같은 이름)
  - (5) `POST /posts/:id/views` + `keepalive`, 비회원 식별은 **서버 발급 쿠키 `df_vid`** 로 결정. `recommendationId` body 수용
  - (6) 인기 글 20건 고정, 10분 캐시
  - (7) 응답 `{ items, total, page, size }`. 하이라이트는 client 처리로 합의, 서버는 `matchedTerms`도 내리지 않음 (ngram 매칭 구간과 사용자가 기대하는 강조가 달라 혼란만 생김). `page` 최대 50
  - (8) `Reason` 구조화, `fallback`, **노출 기록은 응답 시점 서버 기록**으로 결정 (무한 스크롤 페이지 단위 노출이라 실제 노출과 차이 작음). 세부는 M5에서 다시 봄
  - (9) 북마크 `PUT`/`DELETE` 멱등, 북마크 목록에 `total` 포함
  - (10) 관리자 엔드포인트 형태 그대로. 재태깅은 `202 { jobId }` + `GET /admin/jobs/:jobId` 상태 조회
- 변경 요청
  - (2) 리프레시 쿠키는 `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`로 함. same-origin 프록시 구성이라 Strict여도 `POST /auth/refresh` fetch에 쿠키가 실림 (외부 링크 진입 시에도 페이지 안 fetch는 same-site 요청). Lax보다 CSRF 노출이 작음
  - (9) 탈퇴는 `DELETE /me { password }` 대신 `POST /me/withdraw { password }`. DELETE 본문은 프록시·fetch 래퍼에서 버려지는 경우가 있음
  - 게스트 허용 API에 만료된 토큰이 오면 게스트 처리 대신 `401 TOKEN_EXPIRED` 반환함. client는 refresh 후 1회 재시도 필요 (읽음·북마크 표시가 조용히 사라지는 것 방지)
- 다음: dba 스키마 초안 검토 후 `openapi.yaml` 작성하고 다시 검토 요청함

### client (2차)
- 변경 요청 3건 모두 수용함. `conventions.md` 기준으로 구현함
  - (2) `SameSite=Strict; Path=/api/auth` 수용. dev는 Vite proxy same-origin이라 문제 없음
    - 참고: Safari는 `http://localhost`에서 `Secure` 쿠키를 저장하지 않는 경우가 있음. dev에서 Safari 확인이 필요하면 dev 한정 `Secure` 생략 옵션 검토 부탁 (Chrome·Firefox는 localhost를 보안 컨텍스트로 봐서 문제 없음)
  - (9) 탈퇴 `POST /me/withdraw { password }` 수용
  - `TOKEN_EXPIRED` 수용. http 래퍼에서 `code === "TOKEN_EXPIRED"`면 refresh 1회(동시 요청은 refresh Promise 공유) 후 재시도, `REFRESH_TOKEN_INVALID`면 로그아웃 처리하고 게스트로 재요청함
- `size` 파라미터 통일, 검색 `page` 최대 50 반영함 (페이지네이션 UI 최대 50페이지)
- 이 discussion은 client 쪽 합의 완료. openapi 나오면 별도 검토함

### server (2차)
- Safari 참고사항 수용. 환경변수 `COOKIE_SECURE`(기본 `true`)로 dev 한정 `Secure` 생략 가능하게 함. `conventions.md` 4절 반영, 구현 시 `server/.env.example`에 키 추가
- server 쪽도 합의 완료. 남은 결정 사항 없음 → pm은 결정란에 합의 내용 기록 후 decided 처리해도 됨

## 결정 (pm)
- 결정:
- 근거:
- 후속 작업:
