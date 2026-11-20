# DevFeed server

NestJS 12 + TypeORM(MariaDB, mysql2) API 서버. 명세는 `../docs/api/openapi.yaml`, 공통 규칙은 `../docs/api/conventions.md`

## 진행 범위
- M1 수집 파이프라인 (F-001~F-006)
  - 1분 주기 스케줄러 + DB 원자적 선점(`sources.crawl_locked_until`), 동시 수집 `CRAWL_CONCURRENCY`
  - RSS 2.0·RDF·Atom 파싱, ETag/Last-Modified 조건부 요청, 10초 타임아웃, 지수 백오프 재시도 3회, 20MB 제한, EUC-KR 등 charset 처리
  - URL 정규화(추적 파라미터·fragment·끝 슬래시), guid → URL 순 중복 판단, 요약 300자, 썸네일 URL
  - 태그 사전 기반 자동 태깅(제목 → 피드 카테고리 → 요약 순, 최대 5개)
  - 검색 토큰 생성(한글 bigram, `post_search`)
  - 연속 5회 실패 시 `ERROR` + 간격 `min(주기 × 2^(실패-4), 24시간)`, 성공 시 자동 `ACTIVE` 복귀
  - `crawl_runs` 90일 보관 (매일 04:00 KST 삭제)
- 관리자 API: `/api/admin/stats`, `/api/admin/sources/**`, `/api/admin/tags/**`, `/api/admin/jobs/{jobId}`
- 인증 (005 결정으로 M1에 포함): `POST /api/auth/login`, `/refresh`, `/logout`, `GET /api/me`
  - 액세스 토큰 JWT 15분, 리프레시 토큰은 `df_rt` HttpOnly 쿠키(14일, 매 재발급 시 교체, DB에는 SHA-256 해시만 저장)
  - 폐기된 리프레시 토큰이 30초 이후 다시 오면 탈취로 보고 같은 계열 토큰 전체 폐기. 30초 이내는 동시 요청으로 보고 해당 요청만 401
  - 로그인 5회 연속 실패 시 10분 잠금 (`423 LOGIN_LOCKED`, `Retry-After`)
  - 가입·탈퇴·관심 태그는 M4
- 피드 카테고리: `post_search.feed_categories`(줄바꿈 구분, 500자, 카테고리 단위 절단)에 저장하고 재태깅·소스 이름 변경 재색인에 사용. 기존 글은 다음 갱신 때부터 채워짐

- M2 피드 (F-010~F-013)
  - `GET /api/posts`: 커서 `(published_at, id)`, 태그(OR, 최대 10)·소스(최대 20)·유형 필터, 복수 필터는 서브쿼리 `UNION`/`UNION ALL` 분해 (007)
  - `GET /api/posts/popular?period=DAY|WEEK|MONTH`: 최근 24시간·7일·30일 조회수 상위 20건(조회수 1 이상만, 동점은 최신순, 008), 10분 캐시
  - `POST /api/posts/{id}/views`: 같은 viewer(회원 ID 또는 `df_vid` 쿠키) 24시간 1회 집계, 회원은 읽은 기록 저장. `recommendationId`는 형식만 검증 (추천 클릭 기록은 M5)
  - `GET /api/tags`, `GET /api/sources` (소스별 `postCount`·최근 30일 `recentPostCount` 포함, 10분 캐시, 018·019)
  - 로그인 선택 API: 토큰 없으면 게스트, 만료·위조면 401 `TOKEN_EXPIRED`. 회원이면 `isBookmarked`·`isRead` 포함
  - 정리 배치: `post_view_guards` 24시간(매시 5분), `read_histories` 1년(매일 04:00 KST)
- M3 검색 (F-020~F-022)
  - `GET /api/search`: 질의는 저장과 같은 규칙으로 토큰화, 한글 단어는 bigram을 구문(`+"리밸 밸런 런싱"`)으로 묶어 매칭. 관련도 = 제목 일치 × 2 + 전체 일치, 최신순 선택. 페이지 최대 50
  - 토큰이 남지 않는 검색어(1글자 단어만 등)는 DB 조회 없이 0건
  - 하이라이트는 client 처리 (서버는 원문 텍스트만 반환)
  - 성능 (010): 글 10만 건 c=1 API p95 94ms (목표 300ms), c=10 p95 497ms
    - 건수 COUNT는 1,001건에서 중단 → `total ≤ 1000` + `totalCapped`
    - 기간·소스 필터·최신순이 없으면 `post_search`만, 있으면 `posts FORCE INDEX (idx_posts_search_filter)` 커버링 인덱스 조인(`0009`)
    - 같은 검색어·필터 결과(글 ID·건수) 1분 캐시, 회원 플래그는 매번 조회. 측정 시 `SEARCH_CACHE_ENABLED=false`
  - 알려진 한계: 영문은 단어 단위 매칭이라 합성어 안의 단어(`ReactNative`의 react)는 찾지 않음
- M4 회원·개인화 (F-030~F-032, F-040, F-041)
  - `POST /api/auth/signup`: 비밀번호 8~64자 영문·숫자 포함(공백·한글 불가), 닉네임 2~20자, 가입 즉시 로그인 응답, 이메일 중복 409 `EMAIL_DUPLICATED`
  - `PATCH /api/me`, `POST /api/me/onboarding/complete`, `GET`/`PUT /api/me/interest-tags`(3~10개, 저장 시 온보딩 완료)
  - 북마크 `PUT`/`DELETE /api/me/bookmarks/{postId}`(멱등, 5,000건 초과 422), `GET /api/me/bookmarks`(저장 시각 커서, 태그 필터, `total`)
  - 읽은 기록 `GET /api/me/history`(최근 읽은 순 커서), 개별·전체 삭제
  - 탈퇴 `POST /api/me/withdraw`: 비밀번호 확인(틀리면 403 `PASSWORD_MISMATCH`) 후 한 트랜잭션에서 추천 로그 `user_id = NULL` → 회원 조회 guard 삭제 → 회원 삭제(북마크·읽은 기록·관심 태그·리프레시 토큰은 FK CASCADE). 리프레시 쿠키 삭제 (012)
  - 탈퇴 직후 남은 액세스 토큰(최대 15분)의 쓰기 요청은 401 `UNAUTHENTICATED`, 조회 기록은 읽은 기록 저장만 건너뜀
- M5 추천 (F-042, 013)
  - `GET /api/recommendations`: 선호도(관심 태그 3.0, 최근 30일 북마크 2.0·읽기 1.0, 반감기 7일) → 최근 14일 후보(읽음·북마크 제외) 점수(태그 0.7 + 인기 0.2 + 최신 0.1) → 20건 미만이면 인기순 채움 → 같은 소스 최대 2연속
  - 순위 최대 200건 스냅샷을 메모리에 10분 보관 (단일 인스턴스 전제, 만료·다른 회원 커서는 400 `INVALID_CURSOR`)
  - 응답마다 `recommendationId` 발급, 카드당 노출 1행(`TAG_V1`/`COLD_POPULAR`). 클릭은 `POST /posts/{id}/views`의 `recommendationId`로 첫 클릭만 기록
  - 일일 정리(04:00 KST)에 추천 일별 집계(UTC 최근 7일 재집계) → 성공 시 90일 지난 노출 원본 삭제
  - 성능: 회원 1만 기준 첫 페이지 c=1 p95 18.6ms, 다음 페이지 5.9ms
- M6 운영 (014)
  - `GET /api/health`: DB까지 확인, 정상 200 `{ status: OK, db: OK }`, 실패 503. 속도 제한 제외
  - 보안 헤더: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`
  - 실제 클라이언트 IP: `trust proxy loopback` + nginx `X-Forwarded-For`(Cloudflare 실제 IP 복원 후 전달)
  - 속도 제한(`@nestjs/throttler`, IP 기준): 기본 1분 120회, 가입 10분 5회, 로그인 1분 10회, 리프레시 1분 30회, 검색·조회 기록 1분 60회. 초과 시 429 `RATE_LIMITED` + `Retry-After` (`docs/api/conventions.md` 6-1)
  - 한계: 한도 카운터는 서버 메모리라 재시작하면 초기화됨 (단일 인스턴스 전제)
  - 배포 경로 확인 (015): 외부 경로와 로컬 호출을 번갈아 보내 `X-RateLimit-Remaining`이 따로 줄어드는지 확인. 같이 줄면 프록시가 실제 IP를 넘기지 못하는 것임 (Cloudflare Tunnel은 nginx에 127.0.0.1로 접속하므로 `set_real_ip_from 127.0.0.1` 필요)
    ```bash
    curl -sI https://formulous.org/portfolio/api/tags?size=1 | grep -i ratelimit-remaining
    curl -sI http://127.0.0.1:3000/api/tags?size=1 | grep -i ratelimit-remaining
    ```

## 구조
```
src/
├── main.ts, app.module.ts
├── config/            # 환경변수 로드·검증
├── common/            # 에러 형식, 예외 필터, 검증 파이프, 커서, DB 설정
├── auth/              # 로그인·리프레시·로그아웃, JWT 가드, @Roles
├── entities/          # DDL 0001~0004 매핑 (synchronize: false)
├── ingest/            # 순수 함수: URL 정규화, 텍스트·요약, 토큰화, 태깅, 피드 파싱·fetch, 백오프
├── crawl/             # 스케줄러, 수집 실행, 글 저장·재색인, 태그 사전 캐시, 일일 정리
├── admin/             # 관리자 컨트롤러·서비스, 백그라운드 작업(재태깅)
├── me/                # GET /me
├── catalog/           # 공개 태그·소스 목록, 태그 글 수 캐시
├── posts/             # 피드·인기 글·조회 기록, 카드 조립
└── scripts/           # 관리자 계정 생성, 개발용 토큰 발급
```

## 설정
- `.env.example`을 참고해 `server/.env` 작성 (값은 직접 입력)
  - `JWT_ACCESS_SECRET`: 32자 이상
  - `COOKIE_SECURE`: dev Safari 확인 시에만 `false`
  - `CRAWL_SCHEDULER_ENABLED`: `false`면 주기 수집 중지 (즉시 수집 API는 동작)
  - `SEARCH_CACHE_ENABLED`: 검색 결과 1분 캐시 (성능 측정 시 `false`)
  - `RATE_LIMIT_ENABLED`: IP 기준 속도 제한 (기본 `true`, e2e는 기본 `false`)
- DB 스키마는 `../db/migrations`(dba)로만 반영함. 서버는 DDL을 실행하지 않음

## 실행
```bash
npm install
npm run build
npm run start:dev          # http://localhost:3000/api
npm test                   # Jest 단위 테스트
```

## 운영 실행 (launchd, 014)

로그인 시 자동 시작·비정상 종료 시 재시작. 템플릿과 스크립트는 `server/deploy/`

```bash
server/deploy/install.sh     # 최초 1회: npm ci → build → ~/Library/LaunchAgents에 등록 → 헬스 체크
server/deploy/deploy.sh      # 코드 갱신 후: npm ci → build → 재시작(kickstart -k) → 헬스 체크
server/deploy/uninstall.sh   # 해제 (서버·로그 회전 에이전트 모두)
launchctl print gui/$(id -u)/org.formulous.portfolio-server   # 상태
tail -f server/logs/server.log server/logs/server.err.log      # 로그 (gitignore)
```
- 설치 전 `:3000`에 수동 실행 중인 서버가 있으면 `install.sh`가 중단함 (먼저 종료)
- `.env`는 서버 디렉터리 기준으로 읽음 (`WorkingDirectory`). Node는 설치 시점의 `command -v node` 경로로 고정
- 로그 회전: 별도 에이전트 `org.formulous.portfolio-logrotate`가 매시간 `deploy/rotate-logs.sh` 실행
  - `server.log`·`server.err.log`·`logrotate.log`가 10MB를 넘거나 마지막 회전 후 24시간이 지나면 `*.1.gz`로 복사·압축 후 원본을 비움(copytruncate), 7세대 보관
  - 서버 재시작 불필요: launchd가 로그를 이어쓰기(`O_APPEND`) 모드로 열어서 원본을 비워도 파일 끝부터 이어 씀 (`lsof +fg`로 `AP` 플래그 확인)
  - 한계: 복사와 비우기 사이에 쓰인 몇 줄은 잃을 수 있음
  - 수동 실행: `FORCE=1 server/deploy/rotate-logs.sh`. 기존 설치에 회전만 추가: `server/deploy/install-logrotate.sh` (`install.sh`는 자동 포함)
  - `newsyslog`는 쓰지 않음: `/etc` 설정에 sudo가 필요하고, 이름 변경 방식이라 launchd가 연 파일을 서버가 다시 열 수 없음
- nginx 자동 시작·DB 백업 등록은 각각 pm·dba 범위 (014)

## 관리자 계정
```bash
npm run build
ADMIN_PASSWORD='<8~64자 영문+숫자>' npm run admin:create -- --email admin@example.com
# 관리자 계정은 온보딩 완료 상태로 생성됨 (006). 이미 있는 계정이면 비밀번호만 재설정됨
# 로그인은 POST /api/auth/login, 스크립트로 토큰만 받을 때는 아래 사용
npm run admin:token -- --email admin@example.com    # 액세스 토큰 출력 (유효 JWT_ACCESS_TTL_SEC)
curl -H "Authorization: Bearer <토큰>" localhost:3000/api/admin/stats
```

## 성능 리포트 (M6 정리, 2026-11-19)

측정 환경: 맥미니 로컬, MariaDB 12.1.2 Docker(버퍼 풀 128MB 기본값), Node 24.22.3, 단일 서버 프로세스. 응답 시간은 API 왕복(로컬 HTTP) 기준이고 DB 시간과 구분해 적음.
목표 판정은 동시 요청 1(c=1) 기준이고, c=10은 참고 지표 (010 결정).

| 영역 | 데이터 규모 | 목표 | 결과 | 근거 |
|---|---|---|---|---|
| 수집 (M1) | 시드 소스 36곳 → 글 2,383건 | 실패 격리·중복 0 | 36곳 첫 수집 약 20초, 중복 0건, 재수집 신규 0 | 아래 M1 절 |
| 피드 (M2) | 글 2,383건 (API) / 10만 건 (DB) | p95 300ms | API p95 2.5ms, 10만 건 DB p95 최대 6.2ms(최악 필터 조합) | 007 |
| 검색 (M3) | 글 10만 건 | c=1 p95 300ms | c=1 p95 94ms, c=10 p95 497ms | 010 |
| 추천 (M5) | 회원 1만, 읽은 기록 191만 | c=1 p95 300ms | 첫 페이지 p95 18.6ms, 다음 페이지 5.9ms, c=10 p95 52ms | 013 |

### 검색 개선 과정 (010)
| 단계 | 조치 | c=1 p95 | c=10 p95 |
|---|---|---|---|
| 최초 | bigram FULLTEXT + `posts` 조인 + 정확한 COUNT | 923ms | 3,057ms |
| A | 건수 COUNT를 1,001건에서 중단 (`total ≤ 1000` + `totalCapped`) | 301ms | 965ms |
| A + 0009 | 필터·최신순 없으면 `post_search`만, 있으면 커버링 인덱스(`idx_posts_search_filter`) 강제 조인 | **94ms** | **497ms** |
- 원인 분해("개발", 결과 2.4만 건): 정확한 COUNT 140ms, 관련도 정렬의 `posts` 조인 549ms(조인 없이 134ms)
- 기각한 안: `post_search` 비정규화 — FULLTEXT 테이블 컬럼 추가가 10만 행 277초 쓰기 잠금이고 실측 이득이 거의 없음 (dba 실험)
- 비교 기준 `LIKE '%검색어%'`: 결과 수와 무관하게 160~320ms. FULLTEXT는 드문 단어에서 100배 이상 빠름
- 정확성: 개발 DB 13개 질의 정밀도 1.00, 재현율은 영문 합성어 3건 외 1.00

- 글 카드 인기 배지 (020)
  - 모든 `PostSummary`에 `isPopular`: 7일 인기 상위 20건(`/posts/popular?period=WEEK`) 포함 여부. `PopularIdsService`의 기간별 인기 ID 10분 캐시를 인기 글 API와 함께 써서 추가 쿼리 없음 (캐시 만료 직후 1회만 조회)

### 검증 중 발견해 고친 성능·안정성 문제
- 동시 수집 데드락(M1): gap lock 충돌 → READ COMMITTED, `FOR UPDATE` 제거, 데드락 재시도. 이후 36곳 동시 수집 재발 0
- 인기 글 조회수 0 노출(008): `view_count > 0` 조건
- 검색 흔한 단어 지연(010): 위 표

### 측정 재현
- 측정 DB `devfeed_perf`(dba 시드, `db/scripts/perf-seed.sh`)에 측정 서버를 따로 띄움
  ```bash
  DB_DATABASE=devfeed_perf CRAWL_SCHEDULER_ENABLED=false SEARCH_CACHE_ENABLED=false PORT=3100 node dist/main
  node perf/search-latency.js           # 검색 API (ITER=반복 수)
  node perf/recommendation-latency.js   # 추천 API (devfeed_perf에 노출 행 추가됨)
  node perf/search-profile.js           # 검색 쿼리 단계별 DB 시간
  node perf/search-accuracy.js          # 검색 정확성 (개발 서버 :3000 + devfeed, 읽기 전용)
  ```
- 각 스크립트는 연결된 DB 이름을 확인하고 다르면 중단함 (`perf/_db.js`)

## M1 DB 연동 검증 결과 (2026-11-19, 로컬 MariaDB 12.1, 시드 소스 36곳)

| 항목 | 결과 |
|---|---|
| 주기 수집 | 스케줄러 첫 tick에서 36곳 모두 수집, 약 20초 소요 |
| 수집량 | 글 2,383건, 태그 부여 글 1,781건(75%), 썸네일 515건 |
| 중복 | URL·(소스, guid)·(소스, 제목) 중복 0건. 36곳 동시 재수집 시 신규 0·갱신 0(304 응답 13곳), 글 수 변화 없음 |
| 데이터 규칙 | 요약 300자 초과 0, 요약 내 HTML 태그 0, 미래 발행일 0, URL 내 utm 0, `post_tags.published_at` 불일치 0 |
| 실패 격리·재시도 | mock 피드 500: 시도 4회(1·2·4초 백오프, 약 7초) 후 FAILURE. 같은 시간 다른 소스 수집은 정상 처리. 5회 연속 실패 → `ERROR`, 다음 수집 60분 뒤(30분 × 2). 무응답: 10초 × 4회 = 47초 후 timeout 기록 |
| 상태 전환 | resume(ERROR→ACTIVE), PATCH INACTIVE 후 즉시 수집 409 `SOURCE_INACTIVE`, 재개 후 성공 시 연속 실패 0 |
| 동시 실행 방지 | 수집 중인 소스 즉시 수집 요청 409 `CRAWL_ALREADY_RUNNING`. 검증 후 RUNNING 이력·잠금 잔존 0 |
| 관리자 API | 13개 경로 정상·오류 응답 확인 (검증 422/409/400, 인증 401 `TOKEN_EXPIRED`, 404, 재태깅 202 + 작업 조회, 중복 실행 409) |
| 검색 토큰 | bigram FULLTEXT 질의 0~1ms (2,383건). "테스트 코드"로 "테스트코드" 포함 글 매칭 |
| 재태깅 | 2,384건 1.9초 |

### 인증·카테고리 추가 검증 (005 후속)
| 항목 | 결과 |
|---|---|
| 로그인 | 없는 이메일·틀린 비밀번호 모두 401 `INVALID_CREDENTIALS`(구분 없음), 이메일 대소문자 무시, 성공 시 `AuthResponse` + `df_rt` 쿠키(HttpOnly·SameSite=Strict·Secure·Path=/api/auth) |
| 잠금 | 5회째 실패에 423 `LOGIN_LOCKED` `retryAfterSec: 600` + `Retry-After: 600`, 잠금 중엔 맞는 비밀번호도 423 |
| 리프레시 | 재발급마다 토큰 교체, 직전 토큰 재사용 401(쿠키 삭제), 쿠키 없음 401, 로그아웃 후 401 |
| `/me`·관리자 | 로그인 토큰으로 `GET /me`, `/api/admin/**` 정상 |
| 피드 카테고리 | 카테고리에만 있는 태그(`쿠버네티스` → Kubernetes)가 재태깅 후에도 유지, 재태깅 전후 태그 행 수 동일 |
| 미검증 | 30초 이후 재사용 시 계열 전체 폐기는 단위 테스트로만 확인 (실서버에서 30초 대기 검증은 생략) |

## M2 피드 검증 결과 (2026-11-19, 글 2,383건)

| 항목 | 결과 |
|---|---|
| 커서 정확성 | 필터 8조합 전체 스크롤 결과가 기준 SQL과 순서까지 일치, 중복·누락 0 |
| 스크롤 중 새 글 | 첫 페이지 뒤 새 글 삽입해도 이후 페이지 중복·누락 0 (새 글은 다음 새로고침에 노출) |
| 응답 시간 | 피드 p50 1.1ms, p95 2.5ms (293요청). 10만 건 측정은 M3 시드 생성 후 |
| 조회 집계 | 비회원 첫 조회·같은 비회원 재조회·다른 비회원·회원 2회 → 조회수 3, guard 3행, 회원 읽은 기록 1행(재조회 시 `last_read_at`만 갱신) |
| 회원 플래그 | 회원 응답에만 `isBookmarked`·`isRead`, 게스트 응답에는 키 없음 |
| 오류 | 없는 글 404, 잘못된 `recommendationId`·`tagIds`·`size`·`period`·알 수 없는 쿼리 400, 잘못된 커서 400 `INVALID_CURSOR`, 위조 토큰 401 `TOKEN_EXPIRED` |
| 정리 | 검증용 조회수·guard·읽은 기록은 원복함 |

### 검증 중 발견해 고친 문제
- 동시 수집 시 데드락(10곳 중 8곳 실패): 기존 글 조회의 `FOR UPDATE`와 빈 범위 `DELETE`의 gap lock이 다른 소스의 INSERT와 충돌함
  - 저장 트랜잭션을 READ COMMITTED로 실행, `FOR UPDATE` 제거(동시 삽입은 `ON DUPLICATE KEY`가 처리), 새 글은 `post_tags` DELETE 생략, 데드락·락 대기 초과(1213/1205) 최대 3회 재시도
  - 수정 후 10곳·36곳 동시 수집에서 재발 0건
- 본문 전체를 넣는 피드(8.8MB, 9.7MB)가 5MB 제한에 걸림 → 20MB로 상향
- 허용되지 않은 필드의 검증 메시지가 영문으로 나옴 → 한국어로 변경
- 데드락으로 실패한 수집 중 일부 글은 이미 저장돼 해당 이력의 `new_post_count`에 잡히지 않음 (7일 신규 글 수가 실제보다 최대 약 240건 적게 보일 수 있음, 이번 검증 데이터 한정)

## 알려진 제약
- 피드 카테고리 저장(`0008`) 이전에 수집된 글은 카테고리가 없어, 재태깅하면 카테고리 기반 태그가 빠짐 (실측: 태그 행 2,940 → 2,820). 해당 글이 갱신되거나 새로 수집되는 글부터 해소됨
- 재태깅 작업 상태는 서버 메모리에 보관함 (재시작 시 소실)
- Node 24.9 이상 필요 (`engines`). Nest 12가 ESM 전용이라 Jest는 `--experimental-vm-modules`로 실행해 require(esm)을 씀 (npm 스크립트에 포함)

## e2e 테스트

- `npm run test:e2e` (Jest `--experimental-vm-modules`, 설정 `test/jest-e2e.json`, 대상 `test/e2e/*.e2e-spec.ts`)
- 전용 DB `devfeed_test`에서만 실행됨 (011). 시작 전 환경변수와 실제 연결 DB 이름을 모두 확인하고 다르면 중단
  - `server/.env.test`가 있으면 그것을, 없으면 `.env`를 읽음. `.env`를 쓸 때는 `DB_DATABASE=devfeed_test npm run test:e2e`
  - 테스트가 실패해 데이터가 남으면 `db/scripts/test-db-reset.sh`(dba)로 초기화
- 각 테스트가 소스·태그·글·회원을 직접 만들고 끝나면 지움 (실행 후 테스트 DB 0행 확인)
- 현재 37건
  - 탈퇴 잔존 (002 필수): `db/queries/withdrawal-check.sql`(dba)을 그대로 읽어 실행. 탈퇴 전 7개 테이블에 데이터가 있음을 확인한 뒤 탈퇴 → 7개 테이블 0건, 추천 로그 `user_id` NULL, 조회수 유지. 비밀번호 틀림 403, 탈퇴 후 로그인·리프레시·남은 토큰 거부
  - 회원 흐름: 가입 검증·중복 → 관심 태그(개수·없는 태그 검증) → 온보딩 완료 → 북마크(멱등·커서·태그 필터·피드 플래그·해제) → 조회 → 읽은 기록(순서·개별·전체 삭제) → 닉네임 변경, 온보딩 건너뛰기, 북마크 5,000건 제한
  - 인증: 리프레시 교체, 30초 이내 재사용 401, 30초 지난 재사용 시 계열 전체 폐기, 로그아웃, 5회 실패 잠금
  - 추천: 콜드 스타트, 개인화(이유·제외·채움·다양성·커서), 다른 회원 커서 거부, 클릭 1회 기록·타인 클릭 무시, 일별 집계
  - 운영: 헬스 체크·보안 헤더, 가입 IP 한도·다른 IP 분리, 헬스 체크 제외, 기본 한도 121번째 429
  - 관리자 API (로컬 mock 피드): 권한 401·403, 소스 검증·등록·중복·잘못된 피드 422, 즉시 수집 성공(URL 정규화·카테고리 저장·동의어 태깅)·재수집 신규 0, 500 응답 시 4회 시도 후 실패, 재개·비활성·비활성 수집 409, 통계, 태그 중복·동의어 충돌·수정, 재태깅 작업 완료, 없는 작업 404
  - 피드: 필터 7조합 끝까지 스크롤 시 기대 순서와 일치·중복·누락 없음, 스크롤 중 새 글, 잘못된 커서·필터 400, 인기 글 조회수 1 이상·동점 최신순
  - 검색: 조사 붙은 단어 매칭, bigram 순서가 뒤섞인 글 제외(구문 매칭), 관련도·최신순, 기간·태그·소스 필터, 토큰 없는 검색어 0건, 길이·페이지 검증, 1,000건 초과 `totalCapped`
  - 소스 목록 `postCount`·`recentPostCount` (018, 019)
  - 글 카드 `isPopular` (020): 7일 인기 상위 집합과 일치, 조회수 0·7일 지난 글 false, 회원 응답 포함
  - 스모크: `GET /api/sources`
