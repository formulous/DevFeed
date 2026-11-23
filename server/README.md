# formulous server

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
    - `sort=VIEWS|COMMENTS` (035, 기본 `VIEWS`): `COMMENTS`면 댓글 수 1 이상 글을 댓글 수순. 캐시 키는 기간·분야·정렬
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
    curl -sI https://formulous.org/api/tags?size=1 | grep -i ratelimit-remaining
    curl -sI http://127.0.0.1:3000/api/tags?size=1 | grep -i ratelimit-remaining
    ```

## 구조
```
src/
├── main.ts, app.module.ts
├── config/            # 환경변수 로드·검증
├── common/            # 에러 형식, 예외 필터, 검증 파이프, 커서, DB 설정
├── auth/              # 로그인·리프레시·로그아웃, JWT 가드, @Roles
├── entities/          # DDL 매핑 (synchronize: false), 0012 post_likes·comments, 0013 user_passkeys·webauthn_challenges, 0014 score_events 포함
├── ingest/            # 순수 함수: URL 정규화, 텍스트·요약, 토큰화, 태깅, 피드 파싱·fetch, 백오프
├── crawl/             # 스케줄러, 수집 실행, 글 저장·재색인, 태그 사전 캐시, 일일 정리
├── admin/             # 관리자 컨트롤러·서비스, 백그라운드 작업(재태깅)
├── me/                # GET /me
├── catalog/           # 공개 태그·소스 목록, 태그 글 수 캐시
├── posts/             # 피드·분야·인기 글·보안 뉴스·조회 기록, 카드 조립
├── reactions/         # 좋아요·댓글·관리자 숨김, 탈퇴 시 반응 정리
├── passkeys/          # 패스키(WebAuthn) 등록·로그인·목록·이름 바꾸기·삭제
├── score/             # 활동 점수 원장 쓰기·등급 계산
└── scripts/           # 관리자 계정 생성, 개발용 토큰 발급
```

## 설정
- `.env.example`을 참고해 `server/.env` 작성 (값은 직접 입력)
  - `JWT_ACCESS_SECRET`: 32자 이상
  - `COOKIE_SECURE`: dev Safari 확인 시에만 `false`
  - `CRAWL_SCHEDULER_ENABLED`: `false`면 주기 수집 중지 (즉시 수집 API는 동작)
  - `SEARCH_CACHE_ENABLED`: 검색 결과 1분 캐시 (성능 측정 시 `false`)
  - `RATE_LIMIT_ENABLED`: IP 기준 속도 제한 (기본 `true`, e2e는 기본 `false`)
  - `WEBAUTHN_RP_ID`·`WEBAUTHN_RP_NAME`·`WEBAUTHN_ORIGINS`(쉼표 구분 origin): 패스키 RP 설정. 기본값은 로컬 개발용 `localhost`·`formulous`·`http://localhost:5175`, 운영은 `formulous.org`·`formulous`·`https://formulous.org`
  - `WEB_BASE_URL`: 커뮤니티 글 정식 주소(`posts.url`)의 웹 기준 주소. 기본 `http://localhost:5175`, 운영 `https://formulous.org` (037 루트 이전 전에는 `/dev-feed`)
  - `POST_NEW_ACCOUNT_LIMIT_ENABLED`: 커뮤니티 글쓰기 가입 24시간 제한 (기본 `true`). 034 시연 데이터 생성 때 잠시 기본 `false`로 해제했다가 복구함. 하루 5개·60초 간격은 항상 적용
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
launchctl print gui/$(id -u)/org.formulous.dev-feed-server   # 상태
tail -f server/logs/server.log server/logs/server.err.log      # 로그 (gitignore)
```
- 설치 전 `:3000`에 수동 실행 중인 서버가 있으면 `install.sh`가 중단함 (먼저 종료)
- `.env`는 서버 디렉터리 기준으로 읽음 (`WorkingDirectory`). Node는 설치 시점의 `command -v node` 경로로 고정
- 로그 회전: 별도 에이전트 `org.formulous.dev-feed-logrotate`가 매시간 `deploy/rotate-logs.sh` 실행
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
- M7 분야 탭·보안 뉴스 (021, 스키마 `0010`)
  - 소스 종류 `kind`(BLOG / SECURITY_NEWS)와 보안 뉴스 지역 `region`. `posts.kind`·`post_tags.kind`는 수집 시 소스 값으로 함께 기록 (비정규화, 종류는 등록 후 변경 불가)
  - 보안 뉴스 수집 규칙: 요약 150자, 썸네일 저장 안 함, `post_search` 색인 안 함(검색 제외). 날짜만 있는 `pubDate`(KISA)는 KST 자정으로 해석
  - 블로그 전용: 최신·기업·개인·태그·분야 피드, 인기 글(`isPopular` 집합 포함), 추천(후보·선호도·콜드 스타트), `/tags` postCount, `/sources`. 북마크·읽은 기록·조회 기록은 뉴스 포함
  - 분야 `field`: 서버 상수 `posts/fields.ts`(분야 → 태그 분류). 분야 태그 ID·소스 종류는 `DirectoryService`가 1분 캐시. 분야만 있으면 분야 태그별 `post_tags` UNION, 태그·소스 필터가 있으면 그쪽이 드라이브하고 분야는 `EXISTS`
  - `sourceIds`는 해당 종류 소스만 남기고 거름 (블로그 피드에 뉴스 출처 ID → 0건)
  - `GET /api/security-news`(지역 → 출처 ID 목록으로 바꿔 소스 인덱스 사용), `GET /api/security-news/sources`(국내 → 해외, 이름순)
  - 관리자 소스: 목록 `?kind=`, 등록 시 `kind`·`region` 검증(뉴스는 `source_type = COMPANY`로 저장), 수정 시 `kind` 불가, 블로그 `region`·뉴스 `type` 400
  - 성능 (`devfeed_perf` 블로그 10만 + 뉴스, `perf/field-latency.js`, 페이지 21건 DB 시간): 분야 7개 단독 p95 0.5~2.9ms, 분야 + 개인 탭 최악 9.3ms, 최신 1.0ms, 보안 뉴스 0.4ms
- 오류 메시지 말투 (024): 사용자에게 보이는 `message`·`fieldErrors[].message`는 해요체 (예: `로그인이 필요해요`, `2~20자로 입력해 주세요`). `code`·응답 형태는 그대로. 환경변수·스크립트·로그 같은 내부 메시지는 음슴체 유지
- M8 좋아요·댓글 (026, 스키마 `0012`)
  - 모든 `PostSummary`에 `likeCount`·`commentCount`(`posts` 카운터 컬럼, 카드 조회에 조인 추가 없음)·`likedByMe`(회원 플래그 조회에 `post_likes` PK 조회 1회, 비회원 `false`)
  - 좋아요 `PUT`·`DELETE /api/posts/{id}/like`: 원하는 상태 지정, `INSERT IGNORE`/`DELETE` 영향 행이 1일 때만 카운터 증감
  - 댓글: 목록(오래된 순 커서, 답글 3개 `ROW_NUMBER`로 한 번에), 답글 더보기, 작성(답글의 답글은 최상위로), 수정(숨김 409), 삭제(답글 있으면 자리 표시, 마지막 답글 삭제 시 자리 표시 정리), 관리자 숨김·해제(멱등)
  - 잠금 순서: 회원 행(작성 시 속도 제한 직렬화) → 글 행 → 부모 댓글 → 댓글. 글 행을 먼저 `FOR UPDATE`로 잡아 같은 글 동시 쓰기의 FK 공유 잠금 → 카운터 갱신 데드락을 없앰 (측정 중 발견: 20개 동시 요청 일부 500)
  - 속도 제한: DB의 최근 24시간 작성 시각으로 1분 5개·하루 200개, 429 `COMMENT_RATE_LIMITED` + `retryAfterSec` + `Retry-After`
  - 탈퇴: `reactions/withdraw-reactions.ts`가 `db/queries/reactions.sql` 순서대로 카운터 감소 → 좋아요·답글 삭제 → 자리 표시·삭제 → 빈 자리 표시 정리 (FK RESTRICT라 빠뜨리면 회원 삭제 실패)
  - 성능 (`devfeed_perf` 글 14만·좋아요 50만·댓글 15만, `perf/reactions-latency.js`, API p95): 최신 피드 게스트 2.5·회원 3.5·회원 10동시 7.8ms, 검색 "개발" 37~38·10동시 137.5ms, 댓글 2,000개 글 첫 페이지 2.0·10동시 6.9ms → 기준 300ms 이하
- M10 프로필 카드·활동 점수 (029, 스키마 `0014`)
  - `GET /api/me/profile`: 닉네임·누적 점수·등급(`level`·`name`·`minScore`·`nextMinScore`)·수치 4개(좋아요·보이는 댓글·읽은 기록·북마크, 요청 시점 `COUNT`). 댓글 `author.grade` 추가
  - 점수 원장 `score_events`(PK `(user_id, kind, ref_id)`) + `users.score` 카운터를 같은 트랜잭션에서 증감. 증감 여부는 원장 쓰기 영향 행 수로만 판단 (`score/score-ledger.ts`)
    - 읽기 +1: 같은 글 1회(PK), KST 하루 30점. 한도 초과분은 행을 남기지 않아 다음 날 다시 적립 가능. 이미 적립한 글은 잠금 없이 먼저 확인해 건너뜀
    - 좋아요 +2: 취소하면 행 삭제·회수, 다시 누르면 다시 +2
    - 댓글 +5: KST 하루 처음 10개(회수된 행도 셈, 11번째부터 0점 행). 본인 삭제·관리자 숨김은 `revoked_at`으로 회수, 숨김 해제는 복구
  - 잠금 순서: 회원 → 글 → 부모 댓글 → 댓글 → 원장. 관리자 숨김은 요청자가 아니라 작성자 회원 행을 먼저 잠그고, 댓글을 다시 잠가 작성자가 같은지 확인
  - 등급 표(`score/score-policy.ts`)는 spec 값을 단위 테스트로 고정. 하루 경계는 KST 자정을 UTC로 바꿔 비교
  - 보관: 매일 04:00 정리 배치가 읽은 기록 1년 만료와 함께 1년 지난 READ 행을 회원당 `ARCHIVE` 1행으로 접음 (회원 행 잠금 후 한 트랜잭션, 점수 그대로). 접힌 글은 다시 읽으면 +1
  - 탈퇴: 원장 FK CASCADE
  - 성능 (`devfeed_perf` 원장 256만 행, `perf/profile-latency.js`, 읽은 기록 1,000·북마크 300·좋아요 50 회원, API p95): 프로필 0.8·10동시 3.9ms, 조회(적립 경로) 3.8·9.8ms, 좋아요 1.8·11.3ms, 최신 피드 2.8·5.9ms, 댓글 2,000개 글 첫 페이지 3.0·7.2ms
- M11 보안 뉴스 인기 (031, 스키마 변경 없음)
  - `GET /api/community/popular?sort=SCORE|COMMENTS|LIKES` (035, 기본 `SCORE` 인기 점수): 댓글순·좋아요순은 그 수 1 이상인 보이는 글만, 동점 최신순, 말머리 필터 그대로
  - 목록 상단 TOP 3 (042): 인기 경로 세 개(`/posts/popular`, `/security-news/popular`, `/community/popular`)에 `sort=REACTIONS`(좋아요 + 댓글 합 1 이상, 합 → 댓글 수 → 최신순)와 `size=1~20`(캐시된 20건의 앞부분) 추가. TOP 3는 `period=WEEK&sort=REACTIONS&size=3`. 정렬 규칙은 `popular-ids.service.ts` `POPULAR_SORT`에 모음. 기존 인덱스로 충분(dba), perf API 첫 요청 8ms 이하
  - `GET /api/security-news/popular?period=DAY|WEEK|MONTH&region=`: 기술 인기와 같은 기준(롤링 기간, 조회수 1 이상 상위 20건, 동점 최신순)·같은 응답(`PopularPost`). 출처 선택은 받지 않음
  - `PopularIdsService`가 종류별 캐시 키(`BLOG:`·`SECURITY_NEWS:`)로 10분 캐시. 기술 인기·`isPopular` 집합은 `kind = 'BLOG'` 쿼리 그대로라 섞이지 않음
  - 지역은 출처 ID 목록으로 바꿔 거름. dba 측정(`devfeed_perf` 뉴스 4만 건) MONTH 전체 DB p95 1.4ms
- M13 페이지별 검색 (038, 스키마 `0017`)
  - `GET /api/search?scope=TECH|SECURITY|COMMUNITY` (생략 = `TECH`). 범위별 필터: `TECH` 태그·출처, `SECURITY` 지역, `COMMUNITY` 말머리. 범위 밖 필터는 400
  - 색인 테이블을 범위별로 나눔: `post_search`(블로그, 그대로), `security_news_search`(수집 시점 `reindex`에서 제목·요약·출처 이름), `community_search`(작성·수정 때 제목·마크다운 제거 본문 앞 2,000자·태그 이름·동의어, `community-store.ts` `indexCommunityPost`)
  - 자유 게시판: 숨김은 검색 때 `community_posts.status = 'VISIBLE'` 조인으로 거르고, 삭제·탈퇴는 `softDeletePost`에서 색인 행 삭제. 검색 캐시 안 씀 (수정·숨김 즉시 반영)
  - 기존 글 색인: `node scripts/backfill-scoped-search.js <database> [--apply]` (빌드 후, 기본은 미리보기만)
  - 운영 반영 (2026-11-23): 0017 → server 배포 → 백필(보안 뉴스 237·자유 게시판 32, 빠짐 0) → dba 정합성 0 → client 배포·대조 완료. 새 범위 적용 시 같은 순서(색인 테이블 먼저, 배포 뒤 백필)
  - 한계: 관리자 태그 이름·동의어 변경은 자유 게시판 색인에 바로 반영 안 됨(글 수정 때 갱신). 자유 게시판 약 8천 글(색인 60MB)에서 본문 색인 길이·버퍼 풀 재검토 (dba)
  - 성능 (`devfeed_perf` 보안 뉴스 4만·자유 게시판 색인 2천, 캐시 끔, API p95): 보안 6.4~14.9ms, 자유 게시판 7.8~8.8ms. 기술 범위 SQL은 이전과 같음
- M12 커뮤니티 (032, 스키마 `0015`)
  - `src/community/`: 글 목록·인기·상세·쓰기·수정·삭제·채택(`CommunityService`), 신고·관리자 신고 처리(`ReportsService`), 숨김 공통 처리(`moderation.ts`)
  - 저장: `posts`(`kind = 'COMMUNITY'`, 내부 소스) + `community_posts`. `posts.url`은 `WEB_BASE_URL/community/posts/{id}`, `posts.summary`는 마크다운을 걷어낸 앞 200자(`markdown-excerpt.ts`). 줄·목록 항목은 ` · `로 잇고, `. ! ? … :`로 끝난 줄 뒤는 공백으로 이음(035). 기존 글 요약 재생성은 `node scripts/regenerate-community-excerpts.js <database> [--apply]` (빌드 후, 기본은 미리보기만). 본문은 받은 원문 그대로 저장하고 렌더링하지 않음
  - 모든 카드에 `kind`, 커뮤니티 카드는 `community`(말머리·작성자 등급·수정 시각·해결·조회수). 숨김·삭제 글은 최신·인기·북마크·읽은 기록·프로필 수치에서 빠짐 (`personal-list.ts` `LISTABLE`)
  - 삭제는 항상 `DELETED`로 남김(제목·본문·태그·작성자 삭제). 댓글 있으면 상세에 자리만, 없으면 404
  - 작성 제한(`write-limit.ts`, 관리자 예외): 가입 24시간, KST 하루 5개, 60초. 개수·마지막 시각은 원장 `POST_WRITE` 행으로 셈. 429 `POST_WRITE_LIMITED` + `reason`·`retryAfterSec`·`availableAt`, `GET /community/write-status`가 같은 계산
  - 점수: 글 +10(하루 처음 3개분, 숨김·삭제 회수, 해제 복구), 받은 좋아요 +1(`LIKE_RECEIVED`, 원장 키에 누른 회원 `actor_id`, 하루 50점·초과분 행 없음·자기 글 0, 취소·글 삭제·누른 회원 탈퇴 시 회수)
  - 신고: 대상 요약 행 `FOR UPDATE` 후 `INSERT IGNORE`로 1인 1회, 서로 다른 3명이면 자동 숨김(`hidden_reason = REPORTS`, 점수 회수, 채택 해제). 관리자 `CLEAR`·숨김 해제 후에는 자동 숨김 제외. 댓글 행을 지울 때 신고 대상도 같이 지움
  - 잠금 순서: 회원 행(좋아요는 누른 회원·작성자를 id 오름차순) → 글 → `community_posts` → 부모 댓글 → 댓글 → 신고 대상 → 원장. 좋아요는 작성자 조회를 트랜잭션 밖에서 먼저 함 (MariaDB 스냅숏 검사 `1020 Record has changed` 회피). `withDeadlockRetry`는 1213·1205·1020을 재시도
  - 0015 호환: 내부 소스는 관리자 소스 API·통계·수집 스케줄러에서 제외
  - 성능 (`devfeed_perf` 보이는 글 19,600건, `perf/community-latency.js`, API p95): 최신 1.2~2.2·10동시 4.8~7.1ms, 말머리 1.4·5.8ms, 인기 MONTH 1.4·6.1ms, 상세 1.5·5.7ms, 댓글 첫 페이지 0.8·2.8ms, 작성 가능 여부 0.8·2.6ms
- M9 패스키 로그인 (027, 스키마 `0013`)
  - `@simplewebauthn/server`는 CBOR·COSE 파싱과 서명 검증만 맡김. 챌린지 발급·1회 소비·만료, origin·RP ID 고정, 사용자 확인 강제, 서명 횟수 역행 거부, 10개 제한, 토큰 발급 통합은 `passkeys/`에서 직접 처리
  - 로그인 `POST /api/auth/passkeys/login/options`·`/login`(IP당 분당 10회, 기존 로그인과 같은 토큰·쿠키). 등록·관리 `POST /api/me/passkeys/registration/options`, `GET`·`POST /api/me/passkeys`, `PATCH`·`DELETE /api/me/passkeys/{id}`
  - 챌린지: 32바이트 랜덤, DB `webauthn_challenges`에 SHA-256만 저장(5분). 검증 때 `clientDataJSON` 안 값으로 찾아 `DELETE` 영향 행 1일 때만 통과 → 재사용·만료 차단. 발급 때 만료 행 100개씩 정리
  - user handle: `users.webauthn_handle` 랜덤 32바이트 (첫 등록 옵션 발급 때 채움). 로그인은 credential id로 찾고 userHandle 일치 확인
  - 서명 횟수: `UPDATE ... WHERE (새 값 > 저장 값 OR 둘 다 0)` 영향 행 0이면 거부 → 같은 응답 동시 제출도 하나만 성공
  - 오류는 원인 구분 없이 `PASSKEY_VERIFICATION_FAILED`(원인은 경고 로그), 등록 안 된 패스키만 `PASSKEY_NOT_FOUND`
  - 비밀번호 잠금(`LOGIN_LOCKED`)은 패스키 로그인에 적용하지 않고, 패스키 로그인 성공이 잠금 상태를 풀지도 않음
  - 탈퇴: 두 테이블 FK CASCADE
- 태그 영어 표기 (023)
  - 태그 분류 값을 영어로 바꿈 (`Backend`·`Frontend`·`Data`·`Database`·`Infra`·`Cloud`·`Mobile`·`Security`·`Architecture`·`Design` 등). dba `0011` 적용 후 `posts/fields.ts`는 영어 값만 묶음 (전환 기간에는 한글·영어 병행 배포로 무중단 전환)
  - 태그 ID 유지, 이름만 영어로 바꾸고 한글 이름은 동의어로 보존 → 자동 태깅·검색(`post_search`에 이름 + 동의어 색인) 결과 유지
  - 태그 사전 캐시는 TTL이 없어 DB를 직접 바꾸면 서버 재시작 또는 관리자 재태깅 필요. 분야 태그 ID 캐시는 1분

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
  node perf/field-latency.js            # 분야·유형·보안 뉴스 피드 쿼리 DB 시간 (빌드 필요)
  node perf/profile-latency.js          # 프로필·조회·좋아요·피드 (측정 회원을 만들고 끝에 탈퇴)
  node perf/reactions-latency.js        # 좋아요·댓글 필드 포함 목록·댓글 API (측정 회원을 만들고 끝에 탈퇴)
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
- 재태깅·소스 이름 변경 재색인은 블로그 글만 대상. 보안 뉴스는 `post_search`가 없어 피드 카테고리가 저장되지 않으므로 수집 시 태그를 유지함 (023에서 재태깅으로 뉴스 태그 20개가 빠진 것을 확인하고 수정·복구)
- Node 24.9 이상 필요 (`engines`). Nest 12가 ESM 전용이라 Jest는 `--experimental-vm-modules`로 실행해 require(esm)을 씀 (npm 스크립트에 포함)

## e2e 테스트

- `npm run test:e2e` (Jest `--experimental-vm-modules`, 설정 `test/jest-e2e.json`, 대상 `test/e2e/*.e2e-spec.ts`)
- 전용 DB `devfeed_test`에서만 실행됨 (011). 시작 전 환경변수와 실제 연결 DB 이름을 모두 확인하고 다르면 중단
  - `server/.env.test`가 있으면 그것을, 없으면 `.env`를 읽음. `.env`를 쓸 때는 `DB_DATABASE=devfeed_test npm run test:e2e`
  - 테스트가 실패해 데이터가 남으면 `db/scripts/test-db-reset.sh`(dba)로 초기화
- 각 테스트가 소스·태그·글·회원을 직접 만들고 끝나면 지움 (실행 후 테스트 DB 0행 확인)
- 현재 90건
  - 탈퇴 잔존 (002 필수): `db/queries/withdrawal-check.sql`(dba)을 그대로 읽어 실행. 탈퇴 전 데이터가 있음을 확인한 뒤 탈퇴 → 12개 테이블(좋아요·댓글·패스키·등록 챌린지·점수 원장 포함) 0건, 추천 로그 `user_id` NULL, 조회수 유지. 비밀번호 틀림 403, 탈퇴 후 로그인·리프레시·남은 토큰 거부
  - 회원 흐름: 가입 검증·중복 → 관심 태그(개수·없는 태그 검증) → 온보딩 완료 → 북마크(멱등·커서·태그 필터·피드 플래그·해제) → 조회 → 읽은 기록(순서·개별·전체 삭제) → 닉네임 변경, 온보딩 건너뛰기, 북마크 5,000건 제한
  - 인증: 리프레시 교체, 30초 이내 재사용 401, 30초 지난 재사용 시 계열 전체 폐기, 로그아웃, 5회 실패 잠금
  - 추천: 콜드 스타트, 개인화(이유·제외·채움·다양성·커서), 다른 회원 커서 거부, 클릭 1회 기록·타인 클릭 무시, 일별 집계
  - 운영: 헬스 체크·보안 헤더, 가입 IP 한도·다른 IP 분리, 헬스 체크 제외, 기본 한도 121번째 429
  - 관리자 API (로컬 mock 피드): 권한 401·403, 소스 검증·등록·중복·잘못된 피드 422, 즉시 수집 성공(URL 정규화·카테고리 저장·동의어 태깅)·재수집 신규 0, 500 응답 시 4회 시도 후 실패, 재개·비활성·비활성 수집 409, 통계, 태그 중복·동의어 충돌·수정, 재태깅 작업 완료(뉴스 글 태그 불변), 없는 작업 404
  - 피드: 필터 7조합 끝까지 스크롤 시 기대 순서와 일치·중복·누락 없음, 스크롤 중 새 글, 잘못된 커서·필터 400, 인기 글 조회수 1 이상·동점 최신순
  - 검색: 조사 붙은 단어 매칭, bigram 순서가 뒤섞인 글 제외(구문 매칭), 관련도·최신순, 기간·태그·소스 필터, 토큰 없는 검색어 0건, 길이·페이지 검증, 1,000건 초과 `totalCapped`
  - 소스 목록 `postCount`·`recentPostCount` (018, 019)
  - 글 카드 `isPopular` (020): 7일 인기 상위 집합과 일치, 조회수 0·7일 지난 글 false, 회원 응답 포함
  - 분야·보안 뉴스 (021): 최신·유형·태그·인기·추천에 뉴스 0건, 분야 단독·유형·태그·소스 AND, 잘못된 분야 400, 뉴스 목록 커서·지역·출처 필터, 출처 목록 순서, `/sources`·태그 글 수 뉴스 제외, 뉴스 북마크·읽음 플래그
  - 관리자 보안 뉴스 소스: 지역 누락·블로그 지역 400, 종류 변경 400, 지역 수정, `?kind=` 필터, 수집 시 요약 150자·썸네일 없음·검색 색인 없음·`post_tags.kind`·날짜만 있는 발행일
  - 태그 영어화 (023): 한글 이름 → 영어 이름 + 한글 동의어로 바꾸고 재태깅해도 태그 글(제목·피드 카테고리 매칭)·한글 검색 결과 동일, 영어 검색 일치, 영어 분류 값도 같은 분야
  - 오류 메시지 해요체 (024): 검증·중복 가입·로그인 실패·미인증·검색어·커서·분야·404 응답의 `code` 유지, `message`·`fieldErrors` 해요체
  - 좋아요·댓글 (026): 게스트 401·없는 글 404, 같은 회원 20개 동시 요청(켜기·끄기 섞음/켜기만) 후 행·카운터 일치, 카드 `likeCount`·`likedByMe`, 작성 검증(공백·1,001자)·원문 그대로·답글의 답글 승격·다른 글 부모 404, 목록 커서·답글 3개·이어 받기, 수정 본인만·`editedAt`, 관리자 숨김 수 감소·멱등·내용 가림·숨김 수정 409, 삭제 자리 표시·자리 표시 정리, 속도 제한 429·`Retry-After`, 탈퇴 후 잔존 0·자리 표시·수 일치, 정합성 검사 6항목(`db/queries/reactions.sql`) 0
  - 패스키 (027, `test/e2e/support/webauthn.ts` P-256 가상 인증기로 응답 직접 서명): 등록 → 로그아웃 → 패스키 로그인 → 리프레시, 옵션 형태·user handle 고정·제외 목록, 챌린지 재사용·다른 origin·다른 RP ID·사용자 확인 없음·서명 횟수 역행(작음·같음)·userHandle 불일치·발급 안 한 챌린지 거부, 0을 계속 쓰는 인증기 허용, 같은 응답 5개 동시 제출 1건만 성공, 등록 안 된 패스키 `PASSKEY_NOT_FOUND`, 다른 회원 챌린지·재사용·origin·사용자 확인 없음 등록 400, 중복 409, 이름 자동 생성·40자 제한·바꾸기·삭제·남의 것 404, 11번째 409, 잠금 중 패스키 로그인, 탈퇴 후 잔존 0
  - 프로필·점수 (029): 초기값·비회원 401, 읽기 같은 글 1회·하루 30점·다음 날 재적립·기록 삭제 후 점수 유지, 한도 경계 동시 조회 10건 정확히 5점, 좋아요 멱등·회수·재적립·20개 동시 요청 후 점수 = 행 수×2, 댓글 하루 10개·삭제·숨김 회수·해제 복구·회수 행도 한도에 셈·숨김 후 삭제, 답글 있는 댓글 삭제 회수, 등급 경계(99→100, 5000 최고 등급 `nextMinScore` null)·댓글 작성자 등급, 1년 지난 읽기 원장 접기(점수 유지·두 번째 접기 누적·접힌 글 재적립), 수치 = 실제 행 수, 정합성 검사 6항목(`db/queries/score.sql`) 0
  - 스모크: `GET /api/sources`
