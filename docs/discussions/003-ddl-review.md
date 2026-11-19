# 003. DDL 초안 서버 검토 (db/migrations 0001~0006)

- 상태: decided
- 제기: server
- 관련: dba
- 관련 문서: `db/migrations/0001~0006`, `db/conf/devfeed.cnf`, `docs/schema/decisions.md`, `docs/discussions/002-server-schema-requirements.md`

## 배경
- 002 결정 사항이 DDL에 반영됐는지와 API 조회 패턴 기준 문제가 없는지 검토함
- 결론: **차단 이슈 없음, 승인**. 아래 제안은 선택 사항이고 반영하지 않아도 `openapi.yaml` 작성·구현에 지장 없음

## 제안 / 한계점

### 확인 완료 (002 결정 반영)
- 중복 키 `uk_posts_url_hash`, `uk_posts_source_guid_hash`, `uk_sources_feed_url_hash` (생성 컬럼) → TypeORM `insert: false, update: false`로 매핑함
- 커서 인덱스 `idx_posts_published`, `idx_posts_source_published`, `idx_posts_type_published`, `idx_post_tags_tag_published` → 피드 필터 조합 전부 인덱스 범위 스캔 가능
- `post_tags.tag_rank` 반영됨 → 002 후속 작업(dba) 완료로 봄
- `post_search` FULLTEXT 2개 + `innodb_ft_min_token_size = 2`, 불용어 OFF
- `users.onboarding_completed_at` → `GET /me`의 `onboardingCompleted`로 사용
- `recommendation_impressions.uk (request_id, post_id)` → 클릭 시 `recommendationId`(= request_id) + post_id로 갱신
- 탈퇴 CASCADE 대상 4개 테이블 FK 확인. `recommendation_impressions`는 FK 없음 → 서버 트랜잭션에서 `user_id = NULL`

### 제안 (선택)
1. `sources.next_crawl_at`을 `NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`로 바꾸길 제안함
   - 지금은 NULL이면 스케줄러 조건 `next_crawl_at <= NOW()`에서 빠져 영원히 수집 안 됨. 서버가 등록 시 값을 넣긴 하지만 시드 SQL로 넣은 소스가 누락될 위험이 있음
   - 반영 안 하면 시드에서 `next_crawl_at = NOW(3)`을 꼭 넣어주길 요청함
2. `crawl_runs.result = 'RUNNING'`이 프로세스 종료로 남는 경우 처리
   - 서버가 선점 시 해당 소스의 `RUNNING` 이력 중 `started_at`이 선점 만료(5분)보다 오래된 것을 `FAILURE`, `error_message = 'interrupted'`로 정리함. 스키마 변경 불필요, 동작 공유 목적
3. 재태깅 작업 상태(`202 { jobId }` + `GET /admin/jobs/{jobId}`)는 테이블 없이 서버 메모리에 보관함 (단일 인스턴스, 재시작 시 상태 소실 허용). 스키마 변경 불필요
4. 인기 태그(`GET /tags?sort=postCount`)는 `post_tags` 40만 행 `GROUP BY tag_id`라 서버에서 10분 캐시함. D-11과 같은 입장

### 서버 연결 설정
- D-01 요청대로 TypeORM `timezone: 'Z'` + 연결 시 `SET time_zone = '+00:00'` 적용함 (`devfeed.cnf`의 `default-time-zone`과 이중 보장)

## 의견

### server (1차)
- 위 내용대로 승인함. 1번만 dba 판단 부탁함

### dba (1차)
- 1번 반영함: `sources.next_crawl_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` (`0001`, `tables.md`)
  - 기본값은 세션 타임존 기준 → `devfeed.cnf` `default-time-zone='+00:00'` + 서버 세션 설정으로 UTC 보장
  - 시드에서 값 생략 가능
- 2번 동의. 정리 쿼리는 `idx_crawl_runs_source_started` 범위라 비용 작음
- 3·4번 동의, 스키마 변경 없음
- 남은 작업: 사용자 승인 후 `devfeed` DB 생성·설정 적용·up→down→up 검증, 시드(소스 30곳+, 태그 100개+) 작성

### server (2차)
- 1번 반영 확인. `openapi.yaml`의 `AdminSource.nextCrawlAt`를 non-null로 맞춤
- 서버 쪽 합의 완료. 남은 결정 없음

## 결정 (pm)
- 결정 (2026-11-19): DDL `0001~0007` 승인
  - 1: `sources.next_crawl_at` NOT NULL + 기본값 현재 시각 (dba 반영 완료)
  - 2: 프로세스 종료로 남은 `RUNNING` 이력은 선점 시 `FAILURE`(`interrupted`)로 정리. F-006 화면에서는 실패로 표시
  - 3: 재태깅 작업 상태는 서버 메모리 보관, 재시작 시 소실 허용 (관리자 기능이라 재실행으로 충분)
  - 4: 인기 태그 10분 캐시
- 근거: server·dba 합의 완료, dba가 컨테이너에서 up → down → up과 핵심 동작(중복 키, bigram 검색, 선점, 커서 EXPLAIN) 검증 완료
- 후속 작업:
  - dba - 시드 작성 (소스 30곳+, 태그 사전 100개+) — M1 범위
  - 사용자 - `server/.env` DB 접속 정보 제공 (server 구현 착수 전 필요)

### dba (2차)
- 컨테이너 적용 완료: DB `devfeed` 생성, `devfeed.cnf` 반영, 0001~0007 up → down → up 통과
- 중복 키, CHECK, bigram 검색, view guard affected rows, 선점 UPDATE, 커서 EXPLAIN 확인 (`db/README.md` 검증 기록)
- `server/.env` 접속 정보는 사용자에게 요청 필요
