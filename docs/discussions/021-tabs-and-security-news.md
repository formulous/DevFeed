# 021. 상단 탭 확대·확장 (기업·개인·분야) + 보안 뉴스

- 상태: decided (구현 진행)
- 제기: pm (사용자 요청)
- 관련: dba, server, client
- 관련 문서: `docs/spec/02-features.md` F-015·F-016·F-070·F-071, `docs/spec/03-screens.md` 공통 레이아웃·S-13·S-14, `docs/spec/04-roadmap.md` M7

## 배경
- 사용자 피드백 (2026-11-20): 상단 탭(최신·추천·인기)이 너무 작고 종류가 적음. 보안 뉴스 탭을 추가하고 최신 보안 뉴스도 제공하자
- 사용자 결정 (2026-11-20)
  - 추가 탭: **분야 탭**, **기업·개인 블로그 탭**, **보안 뉴스 탭** (트렌드 탭은 제외)
  - 보안 뉴스 출처: **국내 + 해외**
- pm 사전 확인 (RSS 응답, 2026-11-20)
  | 출처 | 지역 | 피드 URL | 결과 |
  |---|---|---|---|
  | 데일리시큐 | 국내 | `https://www.dailysecu.com/rss/allArticle.xml` | 200, 50건 |
  | KISA 보호나라 보안공지 | 국내 | `https://www.boho.or.kr/kr/rss.do?bbsId=B0000133` | 200, 10건 |
  | AhnLab ASEC | 국내 | `https://asec.ahnlab.com/ko/feed/` | 200, 30건 |
  | The Hacker News | 해외 | `https://feeds.feedburner.com/TheHackersNews` | 200, 50건 |
  | BleepingComputer | 해외 | `https://www.bleepingcomputer.com/feed/` | 200, 15건 |
  | SecurityWeek | 해외 | `https://www.securityweek.com/feed/` | 200, 10건 |
  - 보안뉴스(boannews.com)는 RSS 주소가 HTML을 돌려줘 제외. KISA `B0000127`(보안 공지 외 게시판)은 dba·server가 내용 확인 후 추가 여부 판단

## 결정 (pm)

### 1. 탭 구성과 크기 (F-015)
```
│ DevFeed   [검색 .................. 🔍]                    로그인 │
│ 최신   추천   인기   기업 블로그   개인 블로그   보안 뉴스          │ ← 1단 탭
├──────────────────────────────────────────────────────────────┤
│ 전체 · 백엔드 · 프론트엔드 · AI · 데이터 · 인프라 · 모바일 · 보안   │ ← 2단 분야 탭 (최신·인기·기업·개인에서만)
```
- 1단 탭 크기: 글자 15~16px, 탭 높이 48px 이상(터치 대상), 활성 탭은 굵게 + 밑줄 3px. 지금(작은 글자)보다 확실히 크게
- 2단 분야 탭: 1단보다 작게(14px), 알약형 세그먼트. 기본 `전체`
- 모바일: 1단·2단 모두 가로 스크롤(양끝 흐림 표시), 활성 탭이 화면 밖이면 자동으로 보이게 스크롤
- URL: 탭마다 경로, 분야는 쿼리 (`?field=backend`) — 경로 이름은 client가 정하고 03에 반영 요청
- 추천 탭은 분야 탭 없음 (개인화 결과 유지), 보안 뉴스 탭은 별도 하위 구성(아래 3번)

### 2. 기업·개인 블로그 탭, 분야 탭 (F-016)
- 기업 블로그 = 최신 피드 + 소스 유형 `기업` 고정, 개인 블로그 = `개인` 고정. 사이드바 소스 유형 세그먼트는 이 두 탭에서 숨기고, 소스 선택 창은 해당 유형만 표시
- 분야 = 태그 사전 `category` 묶음. 글의 태그 중 하나라도 해당 분류면 포함
  | 분야 | 포함 분류 |
  |---|---|
  | 백엔드 | 백엔드, 아키텍처 |
  | 프론트엔드 | 프론트엔드, 디자인 |
  | AI | AI |
  | 데이터 | 데이터, 데이터베이스 |
  | 인프라 | 인프라, DevOps, 클라우드 |
  | 모바일 | 모바일 |
  | 보안 | 보안 |
  - 언어·품질·문화·도메인 분류는 `전체`에서만 보임 (분야로 묶기 애매)
  - 묶음 정의 위치(서버 상수 / DB 테이블)는 server·dba가 정함. 바꿀 일이 드물어 상수도 허용
- 분야와 사이드바 태그·소스 필터는 AND
- 인기 탭에서도 분야 적용 (기간 × 분야)
- 성능: 글 10만 건에서 분야 + 커서 피드 p95 300ms 이하 (dba 측정)

### 3. 보안 뉴스 (F-070 수집, F-071 탭)
- 수집
  - 소스에 **종류**(기술 블로그 / 보안 뉴스) 구분 추가, 보안 뉴스는 **지역**(국내/해외) 추가. 기존 36곳은 기술 블로그
  - 위 6곳 시드 등록, 수집 주기 30분 (KISA 60분)
  - 기존 수집 파이프라인(중복 제거·실패 격리·백오프) 그대로 사용
- 저작권 (뉴스는 블로그보다 엄격하게)
  - 저장·표시: 제목, 출처, 발행 시각, 원문 링크, RSS 설명 앞부분 **최대 150자** 요약. **썸네일은 저장·표시하지 않음**. 본문 미저장 원칙 동일
  - 카드 클릭 시 원문 새 탭, 출처 이름 항상 표시
  - 해외 기사는 번역 없이 원문 그대로
- 노출 범위
  - 보안 뉴스는 **보안 뉴스 탭에만** 나옴. 최신·추천·인기·기업·개인·분야·검색에서는 제외 (검색 포함은 Next)
  - 자동 태깅은 기존 사전으로 그대로 적용 (태그 표시 가능), 추천 선호도 계산에서는 제외
  - 북마크·읽은 기록·조회수 기록은 블로그 글과 동일하게 허용. `NEW` 배지 적용, `인기` 배지 미적용
- 보안 뉴스 탭 (S-14)
  - 최신순 커서 무한 스크롤, 날짜 구분선(오늘·어제·M월 D일)
  - 상단 세그먼트 `[전체 | 국내 | 해외]`, 사이드바에는 출처 6곳 칩(다중 선택)
  - 카드: 출처·시간·`NEW` / 제목 / 요약 2줄. 썸네일 없음
- 관리자: A-01·A-02·A-03에 종류·지역 표시·입력

## 수용 기준
- 1단 탭 6개가 1280px에서 한 줄, 360px에서 가로 스크롤로 모두 도달 가능. 탭 높이 48px 이상
- 기업/개인 탭: 해당 유형 글만, 분야 7개 각각 해당 분류 태그 글만 (커서 중복·누락 0)
- 보안 뉴스 6곳 수집 성공, 중복 0, 요약 150자 초과 0, 썸네일 0
- 보안 뉴스 글이 최신·추천·인기·검색 응답에 0건
- 개인정보 안내(S-11) 변경 없음 (새 개인 데이터 없음)

## 후속 작업
- dba - 소스 종류·지역 컬럼, 분야 필터 인덱스 검토, 보안 뉴스 시드 6곳 마이그레이션 → server 검토
- server - `openapi.yaml`에 분야 파라미터(피드·인기), 보안 뉴스 목록 API(지역·출처 필터), 관리자 소스 종류·지역 → client·pm 검토 → 구현. 기존 공개 목록에서 보안 뉴스 제외
- client - 탭 확대·6탭·분야 탭·기업/개인 탭·보안 뉴스 탭(S-14), mock 먼저. 경로 이름 정해 03 반영 요청
- pm - `02-features.md` v1.11, `03-screens.md` 탭·S-13·S-14, `04-roadmap.md` M7, README 진행 현황 (완료)

## 의견

### client (1차) — 경로 결정·API 요청
- 경로 (pm은 03에 반영 요청)
  | 탭 | 경로 | 분야 탭 |
  |---|---|---|
  | 최신 | `/` | O |
  | 추천 | `/for-you` | X |
  | 인기 | `/popular` (`?period=`) | O |
  | 기업 블로그 | `/company` | O |
  | 개인 블로그 | `/personal` | O |
  | 보안 뉴스 | `/security` (`?region=domestic|overseas`, `?sourceIds=`) | X |
  - 분야는 쿼리 `?field=backend|frontend|ai|data|infra|mobile|security`, 없으면 `전체`. 잘못된 값은 `전체`로 해석
  - 탭을 옮길 때 분야는 유지, 태그·소스 필터는 초기화 (탭마다 소스 범위가 달라서)
- client가 원하는 API 형태 (server 명세 기준으로 맞출 것이니 이름은 server가 정해도 됨)
  - 분야: `GET /posts`, `GET /posts/popular`에 `field` 쿼리 (enum `BACKEND|FRONTEND|AI|DATA|INFRA|MOBILE|SECURITY`). 분야 목록·라벨·순서는 client 상수로 둠 (7개 고정이라 목록 API 불필요)
  - 기업·개인 탭: 기존 `GET /posts?sourceType=` 그대로 사용 (변경 없음)
  - 보안 뉴스 목록: 별도 경로 `GET /security-news?cursor&size&region&sourceIds` → `CursorPage<PostSummary>` 제안
    - 카드 재사용을 위해 `PostSummary` 그대로 (`thumbnailUrl: null`, `isPopular: false` 고정)
    - `region`: `DOMESTIC|OVERSEAS`, 없으면 전체
  - 보안 뉴스 출처 목록: 사이드바 칩 6개용. `GET /sources`에 섞지 말고 `GET /security-news/sources` → `{ items: [{ id, name, logoUrl, region }] }` 제안. 기존 `/sources`(기술 블로그 전용)는 지금 응답 그대로 두면 client 변경 최소
  - 북마크·읽은 기록 응답에 보안 뉴스 글이 섞여 나와도 됨 (카드 그대로 표시). 다만 썸네일 null 보장 요청
- client 구현 계획 (mock 먼저)
  - 헤더 1단 탭 6개: 16px·높이 48px·활성 굵게+밑줄 3px. 360px 가로 스크롤, 양끝 흐림, 활성 탭 자동 스크롤
  - 2단 분야 탭: 14px 알약형, 최신·인기·기업·개인에서만
  - `/company`·`/personal`: 홈 화면 재사용, 소스 유형 세그먼트 숨김, 소스 선택 창·빠른 소스 칩은 해당 유형만
  - `/security` (S-14): 날짜 구분선, `[전체|국내|해외]` 세그먼트, 출처 6곳 칩 사이드바(모바일은 S-12 시트), 썸네일 없는 카드·요약 2줄·`인기` 배지 없음
  - 관리자 A-01~A-03 종류·지역 표시·입력은 server 명세 나온 뒤 반영

### pm (1차 검토, 2026-11-20)
- client 경로 확정: `/`·`/for-you`·`/popular`·`/company`·`/personal`·`/security`, 분야 `?field=`. 탭 이동 시 분야 유지·태그/소스 필터 초기화 동의. `03-screens.md` 반영 완료
- API 형태 제안 동의 (최종 이름·형식은 server 명세 우선)
  - `field` enum 7개, 분야 목록 API 없음(client 상수)
  - 보안 뉴스는 별도 경로 + 별도 출처 목록. 기존 `/sources`·`/posts`·`/search`·`/recommendations` 응답에 보안 뉴스 0건 유지 (021 수용 기준)
  - 북마크·읽은 기록에는 섞여도 됨. 보안 뉴스 `thumbnailUrl` 항상 null, `isPopular` 항상 false (server 보장)

### server (1차) — 명세 초안·스키마 요청
- client 제안 형태 그대로 채택 (pm 동의). `docs/api/openapi.yaml` 초안 반영함 → client·pm 검토 요청
  | 항목 | 명세 |
  |---|---|
  | 분야 | `GET /posts`, `GET /posts/popular`에 `field` (`BACKEND·FRONTEND·AI·DATA·INFRA·MOBILE·SECURITY`). 잘못된 값은 400 (client가 URL 단계에서 `전체`로 보정) |
  | 기업·개인 | 기존 `GET /posts?sourceType=` 그대로 |
  | 보안 뉴스 목록 | `GET /security-news?cursor&size&region&sourceIds` → `PostPage`. `thumbnailUrl` 항상 null, `isPopular` 항상 false, `summary` 최대 150자 |
  | 보안 뉴스 출처 | `GET /security-news/sources` → `{ items: [{ id, name, logoUrl, region }] }`, 국내 → 해외, 이름순 |
  | `/sources` | 기술 블로그만 (응답 형태 변경 없음) |
  | 관리자 | 목록·상세에 `kind`·`region`, 목록 `?kind=` 필터. 등록 시 `kind`(기본 BLOG)·`region`(보안 뉴스 필수). `kind`는 등록 후 변경 불가 |
  - 새 enum: `SourceKind` `BLOG|SECURITY_NEWS`, `NewsRegion` `DOMESTIC|OVERSEAS`, `Field`
  - 보안 뉴스 제외 범위: 피드·인기(`isPopular` 집합 포함)·검색·추천(후보·선호도)·`/tags` postCount. 북마크·읽은 기록·조회 기록은 포함
- 분야 묶음 정의: **서버 상수**로 둠 (`field → category[]`). 바꿀 일이 드물고, 요청마다 `tags.category`로 태그 ID 집합을 만들어 10분 캐시함. DB 테이블 불필요
- 보안 뉴스 저장 규칙 (수집 단계에서 적용): 요약 150자 자름, 썸네일 저장 안 함(NULL), `post_search` 색인 안 함 (검색 제외가 쿼리 조건 없이 보장됨, Next에서 검색 포함 시 재색인 작업으로 채움)
- 보안 뉴스 출처의 `source_type`: 화면에서 쓰지 않으므로 `COMPANY`로 저장 (NOT NULL 유지, 컬럼 변경 불필요)

#### dba 요청 (스키마)
- `sources.kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG'`, `sources.region ENUM('DOMESTIC','OVERSEAS') NULL`
- **`posts.kind` 비정규화 필요** (`source_type`과 같은 방식, 소스 kind는 변경 불가라 동기화 문제 없음)
  - 이유: 기본 피드·기업·개인 탭이 모두 "블로그만" 조건을 가짐. 보안 뉴스는 하루 100건 안팎으로 블로그보다 많이 쌓일 것이라 sources 조인 후 거르면 LIMIT 21을 채우려고 뉴스 행을 계속 건너뜀
  - 인덱스 제안: `idx_posts_published (published_at, id)` → `(kind, published_at, id)`, `idx_posts_type_published` → `(kind, source_type, published_at, id)`. 보안 뉴스 지역 필터는 출처 6곳이라 `region` → 출처 ID 목록으로 바꿔 `idx_posts_source_published`를 씀 (posts에 region 불필요)
  - 인기 글은 기간 범위 스캔이라 `kind` 조건만 추가해도 충분 (기존 008 판단과 같음)
- **`post_tags.kind` 비정규화도 필요** (`published_at`과 같은 방식)
  - 이유: 분야·태그 필터는 `post_tags (tag_id, published_at, post_id)` 범위 스캔인데, `보안` 분류 태그는 보안 뉴스 글이 대부분을 차지하게 됨 → posts 조인으로 거르면 `field=SECURITY`가 느려짐
  - 인덱스 제안: `idx_post_tags_tag_published` → `(tag_id, kind, published_at, post_id)`
- 분야 피드 쿼리 계획 (dba 측정용): 태그 필터 없으면 분야 태그마다 `post_tags` 범위 스캔 `LIMIT size+1`을 `UNION` 후 정렬 (007과 같은 분해, 백엔드는 태그 28개). 태그 필터가 있으면 선택 태그 쪽을 분해하고 분야는 `EXISTS (post_tags PK 조회)`로 거름. 측정 SQL은 구현 후 server가 `server/perf/`에 추가하고 10만 건에서 함께 확인
- 시드 6곳: 수집 주기 30분(KISA 60분) 그대로 동의. KISA `B0000127`은 **제외 의견** — 확인 결과 "보고서/가이드" 게시판(랜섬웨어 분석 보고서, 동향 보고서 등)이고 갱신이 몇 주~몇 달 단위, `description` 없음. 뉴스 탭 성격과 다름
- 참고: KISA RSS의 `pubDate`가 `2026-10-28` 같은 날짜만 있는 형식임 → 서버 파서가 처리하는지 구현 때 확인하고, 안 되면 날짜만 있는 형식을 KST 자정으로 해석하게 보완함

#### 진행 순서 (server)
1. 지금: 명세 초안 (완료) → client·pm 검토
2. dba 마이그레이션 나오면 엔티티 매핑 검토 → 구현 (수집 규칙, 블로그 전용 조건, 분야, 보안 뉴스 API, 관리자) → e2e → 배포

### pm (2차 검토, 2026-11-20)
- server 명세 초안 승인 (client 검토 결과에 이견 없으면 확정)
  - 보안 뉴스 제외 범위(피드·인기·검색·추천·`/tags` postCount)와 포함 범위(북마크·읽은 기록·조회 기록) 021 결정과 일치
  - `post_search` 미색인으로 검색 제외 보장하는 방식 동의. Next에서 검색 포함 시 재색인
  - 보안 뉴스 `source_type`을 `COMPANY`로 저장하는 것 허용. 단 관리자 화면(A-01~A-03)에서 보안 뉴스 소스는 유형 대신 지역을 보여 줄 것 (client)
  - `kind` 등록 후 변경 불가 동의
- KISA `B0000127` 제외 동의 (보고서 게시판, 뉴스 탭 성격과 다름). 시드는 6곳 확정
- `posts.kind`·`post_tags.kind` 비정규화와 인덱스 변경은 dba 판단에 맡김. 성능 기준은 021 수용 기준(분야 피드 10만 건 p95 300ms 이하)과 기존 피드 성능(007, DB 최악 6.2ms) 회귀 없음

### client (2차) — 명세 초안 검토
- 찬성. `c0b25ba` 초안이 client 제안과 일치, 추가 요청 없음
  - `field` 잘못된 값 400: client가 URL 파싱 단계에서 `전체`로 보정하므로 요청에 잘못된 값이 가지 않음
  - 보안 뉴스 카드는 `PostSummary` 그대로 받아 기존 카드에 `badges="new"`·썸네일 없음으로 표시
  - 북마크·읽은 기록에 보안 뉴스가 섞이는 것 확인. 카드 그대로 표시 (썸네일 null이라 별도 처리 없음)
- 관리자: A-01 `?kind=` 필터 탭, A-02 종류·지역 표시, A-03 등록 시 종류 선택(보안 뉴스면 지역 필수, 유형 숨김)·수정 시 종류 읽기 전용으로 반영 예정
- client 구현은 사용자 승인 후 mock 기준으로 진행

### pm (명세 확정, 2026-11-20)
- server 명세 초안(`c0b25ba`) 확정. client·pm 이견 없음
- client 구현 착수 승인: 사용자가 이번 기능을 직접 요청했으므로 별도 사용자 승인 없이 mock 기준으로 바로 진행
- 남은 순서: dba 마이그레이션 → server 구현·배포 → client 실서버 연동 → pm 공개 페이지 확인 후 M7 완료

### dba (1차) — 스키마 `0010`·시드·분야 측정
- server 요청대로 반영함. `db/migrations/0010_add_source_kind_and_news_region.sql`
  | 테이블 | 변경 |
  |---|---|
  | `sources` | `kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG'`, `region ENUM('DOMESTIC','OVERSEAS') NULL`, CHECK `ck_sources_kind_region` (뉴스만 region 필수, 블로그는 NULL) |
  | `posts` | `kind` 비정규화. `idx_posts_published` → `idx_posts_kind_published (kind, published_at, id)`, `idx_posts_type_published` → `idx_posts_kind_type_published (kind, source_type, published_at, id)` |
  | `post_tags` | `kind` 비정규화. `idx_post_tags_tag_published` → `idx_post_tags_tag_kind_published (tag_id, kind, published_at, post_id)` |
  - 보안 뉴스 `source_type = 'COMPANY'` (NOT NULL 유지) 동의. `idx_posts_search_filter`(검색)는 변경 없음 (뉴스는 `post_search` 행이 없어 조인 대상 아님)
  - 기존 인덱스는 같은 마이그레이션에서 제거함. `kind` 조건 없는 옛 쿼리는 filesort로 바뀌지만 운영 2.4천 건이라 영향 없음
- 시드 `db/seeds/003_security_news_sources.sql`: 6곳 (국내 3·해외 3), 주기 30분·KISA 60분. KISA `B0000127` 제외 동의 (직접 확인: "보고서/가이드" 게시판)
- 검증: `devfeed_perf`(10만)·`devfeed_test` up → down → up 통과, 10만 건 1초. CHECK 거부 2건 확인. 시드 2회 실행 멱등
- 분야 측정 (`db/perf/measure_field.py`, 블로그 10만 + 합성 보안 뉴스 4만, DB 시간 p95): server 쿼리 계획(분야 태그 `UNION` / 다른 필터가 드라이브 + 분야 `EXISTS`) 그대로 측정
  | 쿼리 | p95 |
  |---|---|
  | 분야 7개 단독 (태그 6~28개) | 0.07~0.29ms |
  | 분야 BACKEND + 개인 탭 (최악, 2만 행) | 5.9ms |
  | 분야 + 태그 / + 개인 소스 2개 | 0.11 / 0.38ms |
  | 인기 MONTH + 분야 / YEAR + 분야 | 4.3 / 3.6ms |
  | 보안 뉴스 전체 / 국내(출처 3곳 UNION ALL) | 0.01 / 0.03ms |
  | 추천 후보 14일 (태그 30개, `pt.kind='BLOG'`) | 0.88ms |
  | 태그별 글 수 (`WHERE kind='BLOG' GROUP BY tag_id`) | 18.7ms |
  - p95 300ms 기준 대비 여유 큼. 분야 묶음 서버 상수 동의 → DB 테이블 없음 (decisions D-19)
- server 요청 (구현 시)
  - 글 저장 시 `posts.kind = sources.kind`, `post_tags.kind = posts.kind`로 함께 기록 (`published_at`과 같은 위치)
  - 블로그 목록 쿼리 전부 `kind = 'BLOG'` 추가: 최신·기업·개인(`p.kind`), 태그·분야(`pt.kind`), 인기·`isPopular` 집합·추천 후보·추천 폴백, `/tags` postCount. 선호도 계산은 `post_tags` 조인에 `pt.kind = 'BLOG'`
  - 소스 필터(`sourceIds`)는 블로그 소스만 받도록 검증 (소스 인덱스 경로라 `kind` 조건 불필요)
  - 정합성 검사: `db/queries/feed.sql` 끝의 쿼리(kind 불일치·뉴스 검색 색인·뉴스 썸네일/150자 초과) 4항목 0 → e2e에 넣어도 됨
  - 참고: 뉴스는 `post_search` 행이 없어 `feed_categories`도 저장 안 됨 → 재태깅 시 제목·요약만 사용 (뉴스 태그는 표시용이라 허용으로 판단, D-20)
- 용량 (pm 참고): RSS 실측 하루 약 35~55건 → 연 2만 건 이하, 약 30MB. 지금 보관 기한 불필요. 버퍼 풀 기준 또는 뉴스 10만 건 도달 시 보관 기한 재검토
- 운영 `devfeed` 적용 순서: `0010` 적용은 사용자 확인 후 진행 (적용해도 현재 서버 동작 영향 없음). `003` 시드는 server 뉴스 수집 규칙 배포 후 넣음 — 먼저 넣으면 현 서버가 블로그 규칙(썸네일·300자·검색 색인)으로 수집함. server 배포 준비되면 알려주기 바람

### pm (dba 1차 검토, 2026-11-20)
- 스키마 `0010`·시드 `003` 승인. 분야 측정 최악 5.9ms로 수용 기준(p95 300ms) 충족, 기존 피드 회귀 없음
- 보안 뉴스 보관 기한: 지금 두지 않음 (연 2만 건·30MB 이하). 뉴스 10만 건 도달 또는 버퍼 풀 기준 초과 시 dba가 재검토 제기
- 뉴스 재태깅이 제목·요약만 쓰는 것(D-20) 허용 — 뉴스 태그는 표시용
- **사용자 승인 (2026-11-20): 운영 `devfeed`에 `0010` 지금 적용**. `003` 시드는 dba 제안대로 server 뉴스 수집 규칙 배포 직후 투입 (server가 배포 준비되면 dba에 알림)

### client (3차) — mock 기준 구현 완료
- 구현: 1단 탭 6개, 2단 분야 탭, `/company`·`/personal`(S-13), `/security`(S-14), 관리자 A-01~A-03 종류·지역
  - 분야 탭은 sticky 헤더 밖에 둠 (스크롤하면 사라짐). 헤더에 넣으면 1280×720 최대 선택에서 017 사이드바 "스크롤 없음" 기준을 못 지켜서임 (mock 539/534px)
  - 탭 이동 시 분야는 유지, 태그·소스 필터는 초기화
- 검증: 테스트 106건 통과(탭·분야·S-13 6건, S-14 4건, 관리자 2건 추가), `build`·`build:web` 성공
  - 캡처 17개 화면 × 360·768·1280 가로 넘침 없음. 탭 높이 48px, 글자 16px(360은 15px), 1280 한 줄, 360 가로 스크롤로 마지막 탭 도달·활성 탭 자동 스크롤
  - 1280×720·1440×900 사이드바 기본·최대 선택 스크롤 없음 유지
- 배포 상태: `build:web` 반영함. 지금 실서버(:3000)는 `field`에 400, `/security-news`에 404를 돌려줌 → server 배포 전까지 formulous에서 분야 선택·보안 뉴스 탭은 오류 화면(재시도). 기본 탭·필터는 정상
- server 배포 후 실서버 확인 예정 (분야 7개 결과, 보안 뉴스 지역·출처 필터, 관리자 종류·지역)

### dba (2차) — 운영 `devfeed`에 `0010` 적용 완료 (2026-11-20)
- 사용자 승인에 따라 적용함. 행 수 전후 동일 (소스 36·글 2,387·`post_tags` 2,826·`post_search` 2,387), 기존 데이터 전부 `BLOG`
- 인덱스 교체 확인, 최신 피드 쿼리가 `idx_posts_kind_published` 사용. kind 정합성 검사 4항목 0
- 실행 중인 서버 `/api/health`·`/api/posts`·`/api/posts/popular` 200 (지연 5ms 이하)
- 남은 작업: `003` 보안 뉴스 시드는 server 배포 직후 적용. server는 배포되면 알려주기 바람
