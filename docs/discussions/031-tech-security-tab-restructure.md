# 031. 기술 뉴스·보안 뉴스 2탭 + 내부 탭 개편

- 상태: decided (M11 완료 2026-11-22)
- 제기: pm (사용자 요청)
- 관련: client, server, dba
- 관련 문서: `docs/spec/02-features.md` F-015·F-017·F-072, `docs/spec/03-screens.md` 공통 레이아웃·S-01·S-02·S-03·S-14, `docs/spec/04-roadmap.md` M11

## 배경
- 사용자 요청 (2026-11-22): 기술 관련 소식이 최신·추천·인기 1단 탭에 흩어져 있음. "기술 뉴스" 탭에 모으고 그 안에 최신/추천/인기 내부 탭을 둠
- 사용자 결정
  - 주소: `/tech/...`로 변경, 옛 주소는 새 주소로 넘김
  - 보안 뉴스에도 최신/인기 내부 탭
  - 비회원: 추천 내부 탭은 보이되 누르면 로그인 안내
  - 사용자별 추천 알고리즘(X 구조 차용)은 이번에 하지 않음. 탭 개편만 진행하고 추천 개편은 별도 discussion으로 미룸

## 결정 (pm)
### 탭 구조
```
1단 탭(글자 탭, 022 스타일 유지):  기술 뉴스   보안 뉴스
┌──────────────────────────────────────────────────────────┐
│ 기술 뉴스 내부 탭:  [ 최신 | 추천 | 인기 ]                      │ ← 본문 맨 위 줄, 세그먼트형
│ 분야 탭:  전체 · BE · FE · AI · Data · Infra · Mobile · Security │ ← 최신·인기에서만 (지금과 같음)
│ (인기는 그 아래 [24시간 | 7일 | 30일] 지금과 같음)                  │
├──────────────────────────────────────────────────────────┤
│ 보안 뉴스 내부 탭:  [ 최신 | 인기 ]                             │
│ 지역:  [전체 | 국내 | 해외]  (최신·인기 공통)                     │
│ (인기는 그 아래 [24시간 | 7일 | 30일])                          │
└──────────────────────────────────────────────────────────┘
```
- 1단 탭 2개로 줄어듦. hero 제목은 1단 탭 이름("기술 뉴스"/"보안 뉴스")
- 내부 탭은 1단 글자 탭과 구분되는 작은 세그먼트(트랙형)로 본문 맨 위 줄에 둠. 분야 탭(글자 탭)과 시각적으로 겹치지 않게 함. 세부 모양은 client 재량, 360px에서 한 줄
- 1단 탭 이동 시 해당 탭의 최신으로 감. 기술 뉴스 안 내부 탭 이동 시 분야 유지, 태그·소스 필터 초기화 (지금 규칙과 같음). 보안 뉴스 내부 탭 이동 시 지역·출처 유지
- 비회원이 기술 뉴스 > 추천을 누르면 기존 로그인 유도 모달(북마크와 같은 것), 탭 이동 없음. 비회원이 `/tech/for-you` 직접 진입 시 기존처럼 로그인 화면으로 (redirect 유지)

### 주소
| 화면 | 새 주소 | 옛 주소 처리 |
|---|---|---|
| 기술 뉴스 > 최신 | `/tech` | `/` → `/tech` (쿼리 유지, replace) |
| 기술 뉴스 > 추천 | `/tech/for-you` | `/for-you` → `/tech/for-you` |
| 기술 뉴스 > 인기 | `/tech/popular` | `/popular` → `/tech/popular` |
| 보안 뉴스 > 최신 | `/security` | 그대로 |
| 보안 뉴스 > 인기 | `/security/popular` | 새 주소 |
- 쿼리(`field`·`tags`·`sourceIds`·`sourceType`·`period`·`region`)는 넘길 때 그대로 유지. `/company`·`/personal` 기존 넘김도 `/tech?sourceType=`로
- 온보딩 완료·로그인 후 기본 이동처의 `/for-you`·`/`도 새 주소로
- 서버 공개 주소(`/dev-feed/api/...`)는 바뀌지 않음. nginx 변경 없음 (SPA 대체 이미 동작)

### 보안 뉴스 인기 (새 기능 F-072)
- 기준은 기술 인기(F-013)와 같음: 기간 DAY/WEEK/MONTH 롤링, 그 기간 발행 보안 뉴스 중 조회수 1 이상 상위 20건, 동점은 최신 발행순, 최대 10분 지연
- `region`(국내/해외) 필터 적용. 출처 선택은 인기에는 적용하지 않음 (상위 20건 목록이라 필터가 겹치면 거의 빔)
- 카드: 보안 뉴스 카드 그대로(썸네일 없음), 순위 번호 표시(S-03과 같음). `인기` 배지는 계속 없음
- 빈 결과: "이 기간에 읽힌 보안 뉴스가 아직 없어요" + 보안 뉴스 최신 이동
- 서버: 새 엔드포인트 또는 기존 `/posts/popular` 확장 중 server가 정해 `openapi.yaml`에 반영. 기술 인기 결과·`isPopular` 집합에는 보안 뉴스가 계속 섞이지 않아야 함
- dba: 보안 뉴스 인기 쿼리가 기존 인덱스로 충분한지 검토. 새 마이그레이션이 필요하면 운영 적용 전 사용자 승인

### 그대로 두는 것
- 추천 알고리즘(F-042) 그대로. 개인화 개편은 다음 discussion
- 프로필 카드·좌우 광고·반응 줄은 개편된 모든 내부 탭 화면에 지금처럼 나옴 (기술 3 + 보안 2 + 검색)
- 검색(`/search`)·내 정보·관리자 주소 그대로
- 보안 뉴스는 여전히 기술 뉴스 최신·추천·인기·검색에서 제외

## 순서
1. server: 보안 뉴스 인기 API 명세 → dba 인덱스 검토 → 구현·배포 (client는 명세 확정 뒤 mock으로 병행)
2. client: 탭·라우팅 개편 + 보안 인기 화면, 옛 주소 넘김. `build:web` 배포
3. pm: 공개 사이트 확인 (5개 내부 탭·옛 주소 넘김·비회원 추천 클릭·360px) 후 종결

## 수용 기준
- 1단 탭은 기술 뉴스·보안 뉴스 2개, 각 내부 탭 주소로 직접 진입·새로고침·공유 시 같은 화면
- `/`, `/for-you`, `/popular`, `/company`, `/personal` 진입 시 새 주소로 넘어가고 쿼리 유지
- 비회원 추천 클릭 시 로그인 유도 모달, 회원은 기존 추천 피드
- 보안 뉴스 인기: 기간·지역 전환 동작, 기술 인기와 결과가 섞이지 않음, p95 300ms 이하
- 360px에서 1단 탭·내부 탭·분야 탭이 겹치거나 가로로 넘치지 않음, 라이트·다크 정상
- 기존 테스트·빌드 통과

## 의견

### dba (1차) — 보안 뉴스 인기 쿼리 인덱스 검토: 새 마이그레이션 불필요
- 쿼리 형태 (기술 인기 F-013과 같은 구조, `kind`만 다름)
  - 전체: `SELECT id FROM posts WHERE kind = 'SECURITY_NEWS' AND published_at >= ? AND view_count > 0 ORDER BY view_count DESC, published_at DESC, id DESC LIMIT 20` → `idx_posts_kind_published` 범위 스캔
  - 지역: 위 조건 + `source_id IN (해당 지역 출처 3곳)` → 옵티마이저가 `idx_posts_source_published` 범위로 바꿔 읽음 (지역 → 출처 ID 변환은 021 D-18과 같음, `posts`에 region 불필요)
- 측정 (`devfeed_perf` 보안 뉴스 4만 건 2년 분포 = 하루 약 55건, 운영 실측 수집량과 비슷, DB p95)
  | 쿼리 | p95 | 읽은 행 |
  |---|---|---|
  | WEEK 전체 / 국내 | 0.28 / 0.14ms | 251 / 122 |
  | MONTH 전체 / 국내 | 1.44 / 0.73ms | 1,499 / 744 |
  | (비교) 기술 인기 MONTH | 3.79ms | 4,961 |
  - 기간 안 보안 뉴스 수에 비례 (MONTH ≈ 1,650건). 기준 300ms 대비 여유 큼 → 인덱스 추가 없음, 운영 마이그레이션 없음
- 정렬 키 `view_count`는 인덱스에 없어 기간 범위를 읽고 정렬함 (기술 인기와 같은 판단, D-08). 뉴스가 하루 수백 건으로 늘면 재검토
- 기술 인기·`isPopular` 집합 분리는 `kind = 'BLOG'` 조건 유지로 보장 (server 쿼리 그대로)

### client (1차) — 착수·보안 인기 API 형태 제안
- 탭·라우팅 개편은 API와 무관해서 바로 진행함 (`/tech`·`/tech/for-you`·`/tech/popular`·`/security/popular`, 옛 주소 쿼리 유지 넘김, 비회원 추천 클릭 로그인 유도). 보안 인기 화면은 아래 형태로 mock 선행, server 명세 확정 후 맞춤
- 보안 인기 API 제안 (server 결정)
  - `GET /security-news/popular?period=DAY|WEEK|MONTH&region=DOMESTIC|OVERSEAS` → `{ items: PopularPost[] }` (기술 인기 `/posts/popular`와 같은 응답 형태: `PostSummary` + `viewCount`, 최대 20건, 페이지 없음)
  - 이유: 보안 뉴스 목록이 이미 `/security-news` 아래에 있고, `/posts/popular`에 보안 분기를 넣으면 기술 인기에 섞이지 않아야 하는 조건을 매번 지켜야 함. 별도 경로면 섞일 일이 구조적으로 없음
  - 반응 줄(`likeCount`·`commentCount`·`likedByMe`)·`isBookmarked`·`isRead`는 다른 목록과 같이 포함 부탁 (카드 공용)
- 내부 탭 모양: 1단 글자 탭·분야 글자 탭과 겹치지 않게 **연한 배경 트랙 + 흰 칸 선택** 세그먼트(작은 크기)로 둠. 인기 기간 선택(테두리 알약형)과도 모양이 다름

### pm (dba 검토 확인, 2026-11-22)
- 보안 인기는 기존 인덱스로 처리, 운영 마이그레이션 없음 → 사용자 승인 절차 불필요. 수용
- 남은 것: server 명세·구현 → client 개편 배포 → pm 공개 확인

### server (1차) — 보안 뉴스 인기 명세·구현
- client 제안 형태 그대로 채택: `GET /security-news/popular?period=DAY|WEEK|MONTH&region=DOMESTIC|OVERSEAS` → `{ items: PopularPost[] }` (최대 20건, 페이지 없음). `openapi.yaml` 반영
  - 기준은 `/posts/popular`와 같음 (롤링 기간, `viewCount` 1 이상, 동점 최신 발행순, 기간 × 지역별 10분 캐시)
  - 카드는 다른 목록과 같은 `PostSummary` + `viewCount`. `thumbnailUrl` null, `isPopular` false, 반응 줄·`isBookmarked`·`isRead`·`likedByMe` 포함
  - `sourceIds` 등 정의되지 않은 쿼리는 400 `VALIDATION_FAILED`, `period` 필수
- 분리: 별도 경로 + 캐시 키 종류 접두사(`BLOG:`/`SECURITY_NEWS:`). 기술 인기·`isPopular` 쿼리는 `kind = 'BLOG'` 그대로
- dba 검토 수용 (기존 인덱스, 마이그레이션 없음)
- 검증: build, unit 154, e2e 71 통과 (보안 인기 e2e 1건 추가: 순서·0조회 제외·지역·기술 인기 분리·회원 플래그·400)
- 운영 배포 완료 → client는 mock을 실 API로 바꿔 배포 진행 가능

### pm (server 배포 확인, 2026-11-22)
- 공개 API 확인: `/security-news/popular?period=WEEK` 200(데일리시큐 1건), `MONTH&region=DOMESTIC` 200, `OVERSEAS` 200(0건, 해외 조회 기록 없음), `sourceIds`·`period` 누락 400. 기술 `/posts/popular?period=MONTH` 결과에 보안 출처 0
- 명세 수용. 남은 것: client 개편 배포 → pm 공개 확인

### client (2차) — 개편·보안 인기 배포, 실서버 확인 (2026-11-22)
- server 명세(`/security-news/popular`) 대조: client 요청은 `period`·`region`만 보냄, 응답 처리 일치. mock도 정의되지 않은 쿼리 400으로 맞춤
- 구현
  - 1단 탭 기술 뉴스(`/tech`)·보안 뉴스(`/security`), 내부 탭 화면에서도 해당 1단 탭 선택 표시. hero 제목 = 1단 탭 이름
  - 내부 탭: 본문 맨 위 연한 트랙 세그먼트(선택 칸 흰 배경 + 테두리, 다크에서도 구분되게 테두리 추가). 그 아래 분야 탭(기술 최신·인기만)
  - 내부 탭 이동: 기술은 `field`만 유지(태그·소스 초기화), 보안은 `region`·`sourceIds` 유지. 보안 인기는 `sourceIds`를 요청에 안 보내고 URL에만 남겨 최신으로 돌아갈 때 유지
  - 비회원 추천: 버튼 → 로그인 유도 모달("추천 글을 보려면 로그인이 필요해요"), 이동 없음
  - 옛 주소 `/`·`/for-you`·`/popular`·`/company`·`/personal` → 새 주소(쿼리 유지, `replace`). 로그인 후 기본·로그아웃·탈퇴 → `/tech`, 온보딩 완료 → `/tech/for-you`
  - 보안 인기: 지역 + 기간, 순위·조회수, 인기 배지 없음, 요약 2줄, 빈 결과 "이 기간에 읽힌 보안 뉴스가 아직 없어요" + 최신 보안 뉴스 링크(지역·출처 유지). 좌측 프로필 카드·광고·반응 줄 그대로
  - 탭 제목: `최신 기술 글`·`나를 위한 추천`·`인기 기술 글`·`보안 뉴스`·`인기 보안 뉴스`
- 검증: 테스트 186건(신규: 탭 구조·내부 탭·비회원 추천·직접 진입·옛 주소 6건·보안 내부 탭 유지·보안 인기 4건, 기존 경로 기대값 갱신)·빌드 통과. mock 1280×720·360px 라이트·다크 가로 넘침 0, 탭 줄 겹침 없음
- 실서버 (formulous.org, 게스트)
  | 항목 | 결과 |
  |---|---|
  | 5개 화면 직접 진입 | `/tech`·`/tech/popular?field=ai`·`/security?region=domestic`·`/security/popular`(+`region`·`period`) 모두 1단·내부 탭 선택 정확, 분야 탭은 기술만 |
  | 옛 주소 | `/`→`/tech`, `/?field=ai`→`/tech?field=ai`, `/popular?period=DAY&field=backend`→`/tech/popular?…`, `/for-you`→`/login?redirect=%2Ftech%2Ffor-you`, `/company?field=backend`→`/tech?field=backend&sourceType=COMPANY`, `/personal`→`/tech?sourceType=PERSONAL` |
  | 비회원 추천 클릭 | 로그인 유도 모달, 주소 `/tech` 그대로 |
  | 보안 인기 API | 200, 기술 인기(MONTH)와 겹치는 글 0 |
  | 360px 다크 | 기술·보안 인기 가로 넘침 0 |
  | 오류 | 페이지 오류·4xx/5xx 0 |
- 회원 추천 내부 탭 → `/tech/for-you` 이동은 테스트로 확인 (실서버 회원 확인은 pm 공개 확인 때 부탁)

### pm (공개 확인·종결, 2026-11-22)
- Playwright 게스트, 1440 라이트·360 다크
  - `/tech`·`/tech/popular`·`/security`·`/security/popular?period=MONTH`: hero 제목 1단 탭 이름, 내부 탭 선택 정확, 분야 탭 기술만, 가로 넘침 0
  - 옛 주소: `/`→`/tech`, `/popular?period=DAY&field=backend`→`/tech/popular?…` 쿼리 유지, `/for-you`→`/login?redirect=%2Ftech%2Ffor-you`
  - 비회원 추천 클릭: 로그인 유도 모달, 주소 `/tech` 유지
  - 보안 인기 30일: 순위·조회수, 인기 배지 없음. 페이지 오류 0
- 회원 추천 내부 탭 이동은 client 테스트로 확인, 실서버 회원 확인은 사용자 로그인 시 확인 항목으로 남김
- 수용 기준 충족, 종결
