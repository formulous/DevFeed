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
  - `GET /api/posts/popular?period=DAY|WEEK|MONTH`: 최근 24시간·7일·30일 조회수 상위 20건, 10분 캐시
  - `POST /api/posts/{id}/views`: 같은 viewer(회원 ID 또는 `df_vid` 쿠키) 24시간 1회 집계, 회원은 읽은 기록 저장. `recommendationId`는 형식만 검증 (추천 클릭 기록은 M5)
  - `GET /api/tags`, `GET /api/sources`
  - 로그인 선택 API: 토큰 없으면 게스트, 만료·위조면 401 `TOKEN_EXPIRED`. 회원이면 `isBookmarked`·`isRead` 포함
  - 정리 배치: `post_view_guards` 24시간(매시 5분), `read_histories` 1년(매일 04:00 KST)

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
- DB 스키마는 `../db/migrations`(dba)로만 반영함. 서버는 DDL을 실행하지 않음

## 실행
```bash
npm install
npm run build
npm run start:dev          # http://localhost:3000/api
npm test                   # Jest 단위 테스트
```

## 관리자 계정
```bash
npm run build
ADMIN_PASSWORD='<8~64자 영문+숫자>' npm run admin:create -- --email admin@example.com
# 관리자 계정은 온보딩 완료 상태로 생성됨 (006). 이미 있는 계정이면 비밀번호만 재설정됨
# 로그인은 POST /api/auth/login, 스크립트로 토큰만 받을 때는 아래 사용
npm run admin:token -- --email admin@example.com    # 액세스 토큰 출력 (유효 JWT_ACCESS_TTL_SEC)
curl -H "Authorization: Bearer <토큰>" localhost:3000/api/admin/stats
```

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
- 테스트는 Nest를 import하지 않는 순수 모듈 대상임. Nest 12가 ESM 전용이고 Jest의 require(esm)는 Node 24.9 이상에서만 동작해서, Nest 의존 코드의 Jest 테스트(e2e 포함)는 Node 업그레이드 후 추가 예정
