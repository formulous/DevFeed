# 002. 스키마 설계 시 서버 조회·쓰기 패턴 요구사항

- 상태: decided
- 제기: server
- 관련: dba, pm, client
- 관련 문서: `docs/spec/02-features.md`, `docs/spec/04-roadmap.md`, `docs/api/conventions.md`, `docs/discussions/001-client-api-requirements.md`

## 배경
- M0에서 `dba` 스키마 초안이 나오기 전, 서버 쪽 조회·쓰기 패턴과 한계점을 먼저 공유해 재작업을 줄이려 함
- `04-roadmap.md` 우선 검토 사항(중복 판단 키, FULLTEXT, 조회수·읽은 기록 부하, 스케줄러, 커서, 인증)에 대한 서버 입장 포함
- 아래는 제안임. 테이블·컬럼 이름과 최종 형태는 `dba`가 정함

## 제안 / 한계점

### 1. 수집 스케줄러 구조 (pm 검토 요청)
- `@nestjs/schedule`로 1분마다 tick → `next_crawl_at <= NOW()`인 활성 소스 조회 → 동시 5개 제한으로 수집
- 중복 실행 방지는 DB 원자적 선점으로 처리 (서버 인스턴스가 늘어도 동작)
  ```sql
  UPDATE source SET crawl_locked_until = NOW() + INTERVAL 5 MINUTE
   WHERE id = ? AND (crawl_locked_until IS NULL OR crawl_locked_until < NOW());
  -- affected rows = 1 이면 선점 성공
  ```
- 필요 컬럼 (`source`)
  - `status` (active / error / inactive), `crawl_interval_min`, `next_crawl_at`, `crawl_locked_until`
  - `consecutive_failures`, `last_success_at`
  - `etag`, `last_modified` (조건부 요청)
  - `feed_url` UNIQUE (긴 URL이면 해시 컬럼 UNIQUE)
- 인덱스: `(status, next_crawl_at)`
- 연속 5회 실패 시 `status=error`, 간격은 `min(주기 × 2^(실패-4), 24시간)`으로 늘림. 관리자 재개 시 `active`·실패 횟수 0
- 큐(Redis/BullMQ)는 쓰지 않음. 소스 30~수백 곳 규모에서 DB 선점으로 충분하고 인프라를 늘리지 않으려는 목적

### 2. 수집 실행 이력 (`crawl_run`)
- 컬럼: `source_id`, `started_at`, `finished_at`, `result`(success/failure/not_modified), `new_post_count`, `updated_post_count`, `attempt_count`, `error_message`(TEXT, 길이 제한)
- 인덱스: `(source_id, started_at DESC)` — 소스 상세 최근 50건, `(started_at)` — 90일 삭제 배치·오늘 요약
- 소스 목록의 "최근 7일 신규 글 수"는 `post(source_id, collected_at)` 인덱스로 집계하거나 `crawl_run.new_post_count` 합산 중 택1. 서버는 후자 선호 (post 스캔 없음)

### 3. 글 중복 판단 키 (F-003)
- 두 가지 UNIQUE 필요
  - `url_hash` UNIQUE: 정규화 URL의 SHA-256 (`BINARY(32)` 또는 `CHAR(64)`). URL은 길어서 직접 UNIQUE 걸기 어려움
  - `(source_id, guid_hash)` UNIQUE: guid도 길이 제한이 없어 해시 권장. guid 없는 피드가 있으므로 nullable
- 서버는 `INSERT ... ON DUPLICATE KEY UPDATE`로 동시 수집에도 중복 0건 보장. UNIQUE가 두 개라 같은 글이 서로 다른 행과 충돌하는 경우는 서버에서 guid 우선 조회 후 처리함
- 정규화 URL 원문은 `url` (VARCHAR(2048) 등)로 별도 저장

### 4. 글 테이블 정렬 키 (F-010 커서 페이지네이션)
- 커서 정렬 키는 `(published_at DESC, id DESC)`
- "발행일이 미래·없음이면 수집 시각으로 대체" 규칙은 **저장 시점에 적용**해 `published_at`을 NOT NULL로 두길 요청함. 조회 시 `COALESCE`를 쓰면 인덱스를 못 탐
  - 원래 피드 발행일은 필요하면 `original_published_at` nullable로 보관
- 필요 인덱스: `(published_at, id)`, `(source_id, published_at, id)`
- 소스 유형 필터(기업/개인)를 조인 없이 처리하려고 `post.source_type` 반정규화 고려 요청. 소스 유형 변경은 드물어 일괄 갱신으로 충분

### 5. 태그 필터 (F-011, 태그 OR)
- `post_tag(post_id, tag_id)` PK와 별도로 `(tag_id, published_at, post_id)` 인덱스 요청 → `post_tag`에 `published_at` 반정규화 필요
  - 이유: 태그 필터 + 커서 조회를 `post_tag` 인덱스 범위 스캔만으로 끝내기 위함. 반정규화가 없으면 태그 인기 글이 많을 때 `post` 조인 후 filesort 발생
  - 태그 여러 개 OR은 `UNION ALL` 후 상위 N개 병합 또는 `tag_id IN (...)` + `GROUP BY post_id` 중 EXPLAIN 보고 결정
- `post_tag.rank`(제목 등장 우선 순서, 최대 5) 컬럼 요청. 카드 태그 노출 순서용
- 태그 사전: `tag(name UNIQUE, category)`, `tag_synonym(tag_id, synonym UNIQUE)`
- A-04 "사용 글 수"는 `tag.post_count` 캐시 컬럼 또는 조회 시 COUNT. 태그 100~수백 개라 서버는 COUNT 쿼리로도 충분함 (반정규화 불필요)

### 6. 검색 (F-020, FULLTEXT ngram)
- 검색 대상이 제목·요약·태그·소스 이름이라 `post`에 `search_keywords` 컬럼(태그명 + 동의어 + 소스 이름을 공백 연결) 반정규화 요청
- FULLTEXT 인덱스 2개 요청 (`WITH PARSER ngram`)
  - `ft_title(title)`: 제목 가중치용
  - `ft_all(title, summary, search_keywords)`
  - 관련도 = `MATCH(title) × 2 + MATCH(title, summary, search_keywords)` (가중치는 측정 후 조정)
- 검색어 2자 이상 규칙과 맞추려면 `ngram_token_size=2`(기본값) 유지 필요. 서버 설정 사항이라 dba가 `db/` 쪽 MariaDB 설정에 명시 요청
- **확인 필요**: MariaDB는 MySQL과 달리 `ngram` 파서를 기본 제공하지 않는 것으로 알고 있음. MariaDB 12.1에서 ngram 사용 가능 여부를 dba가 먼저 확인해 주길 요청함
  - 불가하면 대안: (a) 서버가 저장 시 2-gram 토큰을 만들어 `search_tokens` 컬럼에 넣고 기본 FULLTEXT 사용, (b) Mroonga 엔진 플러그인, (c) 외부 검색엔진. 서버는 (a) 선호 (추가 인프라 없음, 구현 비용 낮음)
- 기간 필터·최신순 정렬 때문에 FULLTEXT 결과와 `published_at` 범위 조건 결합 필요. 성능은 M3에서 측정

### 7. 조회수·읽은 기록 쓰기 부하 (F-012, F-013, F-041)
- 클릭 시 흐름: client는 원문을 즉시 새 탭으로 열고, 동시에 `POST /posts/{id}/views`를 비동기 전송 (기록 실패가 이동을 막지 않음)
- 24시간 중복 제외: `post_view_dedup(post_id, viewer_key, last_counted_at)` PK `(post_id, viewer_key)`
  - `viewer_key` = `u:<userId>` 또는 `v:<df_vid UUID>` (VARCHAR(40) 또는 해시 BINARY(16))
  - `INSERT ... ON DUPLICATE KEY UPDATE last_counted_at = IF(last_counted_at < NOW() - INTERVAL 1 DAY, NOW(), last_counted_at)` 후 affected rows로 카운트 여부 판단
  - 1일 지난 행은 배치 삭제 (테이블 크기 제한)
- 인기 글(F-013)이 "기간 발행 글 중 조회수 상위"라 `post.view_count` 컬럼으로 충분. 인덱스 `(published_at)` 범위 + filesort지만 이번 달 발행 글 수천 건 수준이고 결과를 10분 메모리 캐시함
  - `post` 행 UPDATE가 잦은 게 부담이면 `post_stat(post_id, view_count)` 분리 검토 요청. 서버는 MVP 규모에서 분리 불필요하다고 봄
- 읽은 기록: `user_read(user_id, post_id, last_read_at)` PK `(user_id, post_id)`, 인덱스 `(user_id, last_read_at, post_id)` (커서 목록), `(last_read_at)` (1년 삭제 배치)
- 피드 응답의 `read`/`bookmarked` 플래그는 페이지 글 20건 ID로 `WHERE user_id=? AND post_id IN (...)` 조회 2회. PK로 처리되므로 N+1 없음

### 8. 북마크 (F-040)
- `bookmark(user_id, post_id, created_at)` PK `(user_id, post_id)`, 인덱스 `(user_id, created_at, post_id)`
- 태그 필터는 `post_tag` 조인. 회원당 최대 5,000건이라 비용 허용 범위
- 5,000건 제한은 서버에서 COUNT 후 검사 (동시 요청 경합은 허용 오차로 봄)

### 9. 회원·인증 (F-030, F-032)
- `user`: `email` UNIQUE, `password_hash`, `nickname`, `role`(user/admin), `failed_login_count`, `locked_until`, `created_at`
- `refresh_token`: `user_id`, `token_hash` UNIQUE, `family_id`, `expires_at`, `revoked_at`, 인덱스 `(user_id)`, `(family_id)`, `(expires_at)` 삭제 배치용
- `user_interest_tag(user_id, tag_id)` PK
- 탈퇴 시 개인 데이터 삭제: `bookmark`, `user_read`, `user_interest_tag`, `refresh_token`, 추천 로그를 FK `ON DELETE CASCADE`로 처리할지 서버가 트랜잭션으로 지울지 dba 의견 요청. 서버는 FK CASCADE 선호 (누락 방지)
  - `post.view_count`는 유지되므로 F-032 "집계 유지" 충족. `post_view_dedup`의 `u:<userId>` 키는 1일 내 자동 삭제됨

### 10. 추천 노출·클릭 로그 (F-042, M5)
- `rec_impression(id, user_id, post_id, reason, shown_at, clicked_at NULL)` 정도면 클릭률 산출 가능
- M5 대상이라 M0에서는 테이블 골격만 합의하고 세부는 M5 discussion으로 미뤄도 됨

## 의견

### server (1차)
- 위 1~9는 MVP API 명세 작성에 바로 필요한 항목임. 특히 4·5·6(정렬 키, 태그 반정규화, ngram 지원 여부)은 피드·검색 응답 성능 목표(p95 300ms)에 직결됨
- `dba` 스키마 초안이 나오면 이 문서 기준으로 검토 의견을 추가하고, 그 뒤 `openapi.yaml`을 작성함
- API 공통 규칙은 `docs/api/conventions.md`에 먼저 작성했음 (응답·에러·커서·인증 형식). `client`·`pm`은 `openapi.yaml`과 함께 검토 요청 예정

### pm (1차)
- 1. 스케줄러: 동의. MVP에서 Redis·큐 도입 안 함. 백오프 공식 `min(주기 × 2^(실패-4), 24시간)`을 F-002 "간격 늘림"의 정의로 채택함. 즉시 수집도 같은 선점 로직을 타서 실행 중이면 `CRAWL_ALREADY_RUNNING` 반환하는 것으로 이해함
- 2. 수집 이력: 동의. "7일 신규 글 수"는 `crawl_run.new_post_count` 합산으로 충분함. `not_modified`는 F-006 화면에서 "성공(변경 없음)"으로 표시하고 연속 실패 횟수를 초기화함
- 3. 중복 키: 동의. 형태는 dba가 정함
- 4. 정렬 키: 동의. "발행일 없음·미래면 수집 시각으로 대체"는 저장 시점 규칙으로 기획서(F-010)에 명시함. 원래 발행일 보관은 필수 아님 (dba 판단)
- 5. 태그 반정규화·`post_tag.rank`: 기획 측 이견 없음. 반정규화 여부는 dba 판단. `rank`는 F-005 "제목 등장 우선" 노출 순서에 필요하므로 유지 희망
- 6. 검색: dba의 MariaDB 12.1 ngram 지원 확인을 1순위로 요청함
  - pm 이해로도 MariaDB InnoDB에는 MySQL식 `ngram` 파서가 없음. 확인 결과 불가하면 **(a) 저장 시 2-gram 토큰 컬럼 + 기본 FULLTEXT를 MVP 기준안으로 확정**함. (b) Mroonga, (c) 외부 검색엔진은 MVP에서 제외하고, M3 측정에서 p95 300ms·검색 품질이 미달할 때만 새 discussion으로 재검토함
  - (a) 채택 시 2자 토큰이 인덱싱되도록 `innodb_ft_min_token_size` 등 서버 설정을 dba가 `db/`에 명시해야 함
  - (a)는 "ngram 파서가 없는 DB에서 한글 부분 검색을 직접 구현한 사례"로 포트폴리오 어필 포인트가 되므로 구현 근거·측정 결과를 `docs/schema/decisions.md`에 남겨줄 것
- 7. 조회수: 동의. MVP는 `post.view_count`, `post_stat` 분리는 M3/M6 측정에서 잠금 경합이 보일 때만 검토. 인기 글 10분 캐시는 F-013 "최대 10분 지연"과 일치함
- 8. 북마크: 동의. 5,000건 제한의 동시 요청 경합 오차 허용함
- 9. 인증: `docs/api/conventions.md` 4절 방식 승인 (client는 001에서 Lax를 제안했으나 same-origin 프록시 구조라 Strict로 충분함)
  - 탈퇴 시 삭제 대상: 북마크, 읽은 기록, 관심 태그, 리프레시 토큰은 삭제. 추천 노출·클릭 로그는 클릭률 집계 보존을 위해 `user_id`를 NULL 처리(익명화)해도 됨 (F-032 "집계 수치 유지"와 일치)
  - FK CASCADE vs 트랜잭션 삭제는 dba·server가 정함. 단, 탈퇴 후 개인 데이터가 남지 않는지 검증하는 테스트를 필수로 함
- 10. 추천 로그: M0에서는 골격만 합의, 세부는 M5 discussion으로 미루는 것에 동의함

### server (2차)
- pm 의견 전부 수용함
  - 1: 즉시 수집도 같은 선점 UPDATE를 탐. 선점 실패 시 `409 CRAWL_ALREADY_RUNNING` 맞음
  - 2: `NOT_MODIFIED`는 성공으로 보고 `consecutive_failures` 초기화함
  - 6: dba가 `docs/schema/decisions.md` D-03에서 ngram 불가를 확인함 (12.1.2 플러그인 없음) → (a) 확정. 토큰화 함수는 서버가 구현하고 저장·질의 양쪽에 같은 함수를 씀. 단위 테스트로 규칙 고정
  - 9: 탈퇴는 D-02대로 FK `ON DELETE CASCADE` + 같은 트랜잭션에서 `recommendation_impressions.user_id = NULL` 처리. 탈퇴 후 개인 데이터 잔존 검사 e2e 테스트 작성함
- 5의 `post_tag.rank`는 dba 초안(D-07)에 언급이 없음 → DDL 검토 때 확인함
- 이 discussion의 남은 세부는 dba DDL 검토로 넘어감. pm은 결정란 기록 후 decided 처리해도 됨

### dba (1차)
- 스키마 초안: `docs/schema/erd.md`, `tables.md`, `decisions.md`, `db/migrations/0001~0006`. 테이블 이름은 snake_case 복수형 (`sources`, `posts`, `post_tags` 등, D-01a)

#### 6. ngram 지원 여부 (1순위) — **사용 불가 확인**
- 컨테이너 `mariadb` = 12.1.2-MariaDB. 플러그인 디렉터리에 ngram 파서·Mroonga(`ha_mroonga.so`) 없음. ngram은 MySQL 전용이라 `WITH PARSER ngram` 불가
- 결정(안): server 대안 (a) 채택 — 앱 bigram 토큰 + InnoDB 기본 FULLTEXT (decisions D-03, D-04)
  - 토큰 저장은 `posts`가 아닌 1:1 테이블 `post_search(title_tokens, body_tokens)`. 피드 스캔 시 `posts` 행을 작게 유지하기 위함
  - FULLTEXT 2개: `ft_post_search_title(title_tokens)`, `ft_post_search_all(title_tokens, body_tokens)`. `body_tokens` = 요약 + 태그명·동의어 + 소스 이름 토큰
  - 토큰 규칙: 소문자화·NFKC → 단어 분리 → 한글 포함 단어는 2글자 bigram, 영문·숫자 단어는 그대로(2글자 이상). 저장·질의 동일 함수
  - 질의: `MATCH(...) AGAINST('+리밸 +밸런 +런싱' IN BOOLEAN MODE)`
  - 필요 서버 설정: `innodb_ft_min_token_size=2`, `innodb_ft_enable_stopword=OFF` (`db/conf/devfeed.cnf`). min_token_size는 재시작 필요 → 사용자 승인 후 적용 예정
  - `LIKE '%..%'`는 M3 전/후 비교 기준선으로만 측정
- pm 요청: `02-features.md` F-020, `01-overview.md`의 "FULLTEXT(ngram)" 표현을 "bigram 토큰 + InnoDB FULLTEXT"로 수정 필요

#### 3. 중복 판단 키 — 동의
- `posts.url_hash`, `posts.guid_hash`는 STORED 생성 컬럼 (`UNHEX(SHA2(col,256))`, `BINARY(32)`). 서버는 `url`, `guid`만 쓰고 해시는 쓰지 않음 (TypeORM `insert:false, update:false`) → 해시 불일치 원천 차단
- `uk_posts_url_hash`, `uk_posts_source_guid_hash(source_id, guid_hash)`. guid NULL은 유니크 검사 제외
- 두 키가 서로 다른 행과 충돌하는 경우: `ON DUPLICATE KEY UPDATE`는 먼저 충돌한 한 행만 갱신하므로 server 방식(guid 우선 조회 → url 조회 → upsert) 동의. 이 경우 로그만 남기고 신규 생성하지 않음 권장
- `original_published_at` 추가함 (4번 요청 반영). `posts.source_type` 비정규화 + `(source_type, published_at, id)` 인덱스도 반영

#### 5. 태그 필터 — 동의, 반영함
- `post_tags(post_id, tag_id, tag_rank, published_at)`, PK `(post_id, tag_id)`, `idx_post_tags_tag_published (tag_id, published_at, post_id)`
- `rank`는 예약어 충돌 → `tag_rank` (1~5 CHECK)
- 글 `published_at` 변경 시 `post_tags.published_at`도 같은 트랜잭션에서 갱신 필수
- 태그 OR: 태그 수 상한(10) 두고 태그별 `LIMIT 20` 서브쿼리 `UNION ALL` 권장. M2에서 EXPLAIN 같이 확인
- 동의어 테이블 `tag_synonyms(tag_id, synonym UNIQUE)`, 사용 글 수는 COUNT (캐시 컬럼 없음, D-11)

#### 9. 회원·탈퇴 — FK CASCADE 동의
- `bookmarks`, `read_histories`, `user_interest_tags`, `refresh_tokens`는 `users` FK `ON DELETE CASCADE`
- 예외: `recommendation_impressions`는 FK 없음 (최대 쓰기 테이블, 추후 파티셔닝 대비). 탈퇴 트랜잭션에서 `UPDATE ... SET user_id = NULL` 요청 → 클릭률 집계 유지
- `refresh_tokens.family_id BINARY(16)` 추가 반영
- `users.onboarding_completed_at` 추가 (온보딩 완료/건너뛰기 여부 판단용)

#### 기타
- 2번: 7일 신규 글 수는 `crawl_runs.new_post_count` 합산 채택. `crawl_runs.result` 값 `RUNNING/SUCCESS/NOT_MODIFIED/FAILURE`, `trigger_type(SCHEDULED/MANUAL)` 추가
- 7번: `post_view_guards(post_id, viewer_key BINARY(16), counted_at)` — `viewer_key`는 `u:<id>`/`v:<uuid>`의 SHA-256 앞 16바이트. `post_stat` 분리는 MVP 불필요 동의
- 연결 설정 요청: TypeORM `timezone: 'Z'`, 세션 `time_zone='+00:00'` (모든 `DATETIME(3)`은 UTC)
- 보관 정책·예상 규모: decisions D-09, D-12. `recommendation_impressions` 보관 90일은 pm 확인 필요

## 결정 (pm)
- 결정 (2026-11-19): server 제안 1~10 채택, pm 1차 의견 조건 포함
  - 1: DB 원자적 선점 스케줄러, Redis·큐 미도입. 백오프 `min(주기 × 2^(실패-4), 24시간)`. 즉시 수집도 같은 선점, 실패 시 `409 CRAWL_ALREADY_RUNNING`
  - 2: `NOT_MODIFIED`는 성공 처리, 연속 실패 초기화. 7일 신규 글 수는 `crawl_run.new_post_count` 합산
  - 3·4·5·7·8: 서버안 기준. 세부 형태는 dba 스키마(`docs/schema/decisions.md` D-04~D-11)를 따름
  - 6: MariaDB 12.1 ngram 파서 불가 확인(D-03) → 앱 bigram 토큰 + InnoDB FULLTEXT 확정. 토큰화 함수는 저장·질의 공용, 단위 테스트로 고정. Mroonga·외부 검색엔진은 M3 측정 미달 시에만 재검토
  - 9: `conventions.md` 4절 인증 방식. 탈퇴는 FK `ON DELETE CASCADE` + 같은 트랜잭션에서 추천 로그 `user_id = NULL`, 개인 데이터 잔존 e2e 테스트 필수
  - 10: 추천 로그는 골격만 합의, 세부는 M5 discussion
- 근거: 추가 인프라 없이 MVP 성능 목표(p95 300ms) 달성 가능, 기획 수용 기준과 충돌 없음, 한글 검색 직접 구현은 포트폴리오 어필 포인트
- 후속 작업:
  - pm - `02-features.md` F-002·F-006·F-010·F-032, `04-roadmap.md` 검색 리스크 갱신 (완료)
  - dba - `post_tag.rank`(F-005 태그 노출 순서) DDL 반영 여부 확인. 남은 세부는 DDL 검토에서 처리
  - server - dba DDL 검토 후 `openapi.yaml` 작성

### 결정 보충 (pm, 2026-11-19, dba 1차 의견 반영)
- `recommendation_impressions` 보관: **원본 90일 승인**
  - 단, 클릭률 비교(M5 `TAG_V1` vs N1 TF-IDF)는 90일을 넘겨 이뤄질 수 있으므로 삭제 전에 `(날짜, algorithm)`별 노출 수·클릭 수 일별 집계를 남기고 기간 제한 없이 보관할 것. 테이블 형태·집계 시점은 dba·server가 정함 (개인 식별 정보 없음)
  - 기획 반영: `02-features.md` F-042 수용 기준 추가
- ngram 표현 수정 요청 반영: `01-overview.md`, `02-features.md` F-020, `04-roadmap.md`를 "앱 bigram 토큰 + InnoDB FULLTEXT"로 갱신
- `post_tags.tag_rank` 반영 확인. `db/conf/devfeed.cnf` 적용(MariaDB 재시작)은 사용자 승인 사항으로 남김
- 후속 작업: dba - D-09에 일별 집계 보관 추가, 필요 시 마이그레이션 (완료: D-09, D-10a, `0007`) / server - 삭제 배치 전 집계 처리
- pm 확인 (2026-11-19): D-10a 노출일 기준 귀속·최근 7일 재집계(멱등)·집계 후 삭제 순서 승인. 002 종결

### dba (결정 보충 반영)
- `db/migrations/0007_create_recommendation_daily_stats.sql` 추가: PK `(stat_date, algorithm)`, `impression_count`, `click_count`, `request_count`, 영구 보관
- D-09 갱신, D-10a 신설: 노출 날짜 기준 귀속, 최근 7일 재집계 upsert(멱등), 원본 삭제는 집계 배치 뒤 실행
- server 요청: 일 1회 배치 순서 = 집계(최근 7일) → 원본 90일 삭제. 쿼리는 D-10a 참고

### server (결정 보충 확인)
- D-10a 수용. 일 1회 배치 순서를 `추천 일별 집계(최근 7일 재집계 upsert)` → `recommendation_impressions` 90일 삭제로 고정함. 같은 job 안에서 순차 실행하고, 집계가 실패하면 삭제를 건너뜀
- D-11a(7일 신규 글 수 = `crawl_runs.new_post_count` 합산) 확인
