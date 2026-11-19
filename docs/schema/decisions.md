# 스키마 결정 기록

- 작성: dba
- 상태: 초안 v1 (2026-11-19), `server` 검토 대기
- 기준 문서: `docs/spec/01~04`

## D-01. 공통 규칙
| 항목 | 결정 | 이유 |
|---|---|---|
| 엔진·문자셋 | InnoDB, `utf8mb4` / `utf8mb4_unicode_ci` | 팀 기준. 이모지 포함 제목 대응 |
| DB 이름 | `devfeed` | 서비스명 |
| PK | `BIGINT UNSIGNED AUTO_INCREMENT` | 클러스터드 인덱스에 순차 삽입 → 페이지 분할 최소화. UUID 대비 PK 8바이트로 보조 인덱스 크기 절감 |
| 관계 테이블 PK | 복합 PK (`user_id, post_id` 등) | 별도 surrogate 키 불필요, 중복 방지를 PK가 겸함 |
| 시간 타입 | `DATETIME(3)`, 값은 항상 UTC | `TIMESTAMP`의 2038 한계 회피. ms 정밀도로 커서 동률 감소 |
| 시간 컬럼 | `created_at` 필수, 값이 바뀌는 테이블만 `updated_at` (`ON UPDATE CURRENT_TIMESTAMP(3)`) | 관계·로그 테이블은 갱신이 없어 쓰기 비용만 늘어남 |
| 불리언 | `TINYINT(1)` | TypeORM `boolean` 매핑 기본값 |
| 상태값 | `ENUM` 대문자 | 저장 1바이트, 값 오입력 차단. 값 추가 시 마이그레이션 필요 (드묾) |
| 마이그레이션 형식 | `db/migrations/NNNN_설명.sql`, `-- migrate:up` / `-- migrate:down` 구분 | 순수 SQL로 리뷰 용이. 적용 스크립트 `db/scripts/migrate.sh` |

- `server`에 요청: TypeORM 연결에 `timezone: 'Z'`, 세션 `time_zone = '+00:00'` 설정. `DEFAULT CURRENT_TIMESTAMP(3)`가 세션 타임존을 따르기 때문

## D-01a. 이름 규칙
- 테이블: snake_case 복수형 (`posts`, `post_tags`). 컬럼: snake_case
- 인덱스: `idx_<테이블>_<컬럼요약>`, 유니크: `uk_...`, FULLTEXT: `ft_...`, FK: `fk_<테이블>_<참조>`
- `rank`는 MariaDB 예약어(윈도 함수)와 겹쳐 `tag_rank` 사용

## D-02. soft delete 미사용
- 전 테이블 soft delete 컬럼(`deleted_at`) 두지 않음
- 소스: 삭제 기능이 없고 `status = 'INACTIVE'`로 비활성화 (F-001)
- 글: 삭제 기능 없음
- 회원: 탈퇴 시 하드 삭제 (F-032 개인 데이터 삭제 요구). 북마크·읽은 기록·관심 태그·리프레시 토큰은 FK `ON DELETE CASCADE`로 함께 삭제
- 이유: soft delete는 모든 조회에 `deleted_at IS NULL` 조건과 유니크 키 충돌 문제를 만들고, 탈퇴 회원 개인정보 보관 리스크가 생김

## D-03. 한글 검색: ngram 파서 사용 불가 → 앱 bigram 토큰 + InnoDB FULLTEXT
- 사실 확인: 컨테이너 MariaDB 12.1.2 플러그인 디렉터리에 ngram 파서·Mroonga 없음. ngram은 MySQL 전용 플러그인이라 MariaDB에서 `WITH PARSER ngram` 사용 불가
- 기획서의 "FULLTEXT(ngram)"는 그대로 구현할 수 없음 → `docs/discussions/002-server-schema-requirements.md`에서 pm·server와 합의 (server 대안 (a)와 동일)
- 결정(안)
  - 검색 전용 테이블 `post_search`에 서버가 만든 토큰 문자열 저장, InnoDB FULLTEXT 인덱스 생성
  - 토큰 규칙 (서버 구현, 저장·질의 양쪽에 같은 함수 사용)
    1. 소문자화, NFKC 정규화
    2. 공백·구두점 기준 단어 분리
    3. 한글 포함 단어: 2글자 bigram으로 분해 (`리밸런싱이` → `리밸 밸런 런싱 싱이`). 1글자 단어는 버림
    4. 영문·숫자 단어: 단어 그대로 (`kafka`, `k8s`). 2글자 이상만
  - 질의: 검색어도 같은 규칙으로 토큰화한 뒤 `MATCH ... AGAINST ('+리밸 +밸런 +런싱' IN BOOLEAN MODE)`
  - 필요 서버 설정: `innodb_ft_min_token_size = 2` (기본 3이면 한글 bigram이 버려짐), `innodb_ft_enable_stopword = OFF` → `db/conf/devfeed.cnf`
- 대안과 기각 이유
  | 대안 | 기각 이유 |
  |---|---|
  | `LIKE '%검색어%'` | 10만 건 풀스캔. p95 300ms 위험. 단, M3 전/후 비교 기준선으로 측정에 사용 |
  | Mroonga 엔진 | 공식 이미지에 미포함. 커스텀 이미지 관리 비용 |
  | Elasticsearch 등 외부 엔진 | 1인 운영 비용 증가. M3 측정 결과 목표 미달 시 재검토 (로드맵 리스크 항목) |
- 한계: bigram 특성상 "밸런"만으로 "리밸런싱"이 검색됨(재현율↑ 정밀도↓). 관련도 정렬과 제목 가중치로 보완

## D-04. 검색 데이터를 `posts`에서 분리 (`post_search` 1:1)
- 피드 조회는 `posts`를 대량 스캔함. 토큰 TEXT 컬럼을 `posts`에 두면 행이 커져 버퍼 풀 효율이 떨어짐
- FULLTEXT는 한 테이블 컬럼에만 걸리므로, 검색 대상인 태그명·소스명을 `post_search.body_tokens`에 비정규화해 넣음
- 제목 가중치: `title_tokens` 단독 FULLTEXT + `(title_tokens, body_tokens)` FULLTEXT 두 개를 두고 `MATCH(title)*w + MATCH(title, body)`로 정렬
- 갱신 시점: 글 저장·수정, 재태깅, 태그 동의어 변경, 소스 이름 변경 시 해당 글 토큰 재생성 (모두 배치·관리자 작업이라 빈도 낮음)

## D-05. 중복 제거 키 (F-003)
- `posts.url_hash` = `UNHEX(SHA2(url, 256))` STORED 생성 컬럼, `UNIQUE`
- `posts.guid_hash` = `UNHEX(SHA2(guid, 256))` 생성 컬럼, `UNIQUE (source_id, guid_hash)`. guid 없으면 NULL → 유니크 검사 제외
- URL 정규화(utm_* 제거, 끝 슬래시 통일)는 서버 책임. DB는 정규화된 `url`만 받음
- 해시 사용 이유: URL은 최대 2048자 → utf8mb4 인덱스 키 한도(3072바이트) 초과. 32바이트 해시로 인덱스 크기 고정
- 생성 컬럼이라 서버는 값을 쓰지 않음 (TypeORM `insert: false, update: false`). 해시 계산 불일치 위험 없음
- 동시 수집 중복 0건은 유니크 키가 보장. 서버는 `INSERT ... ON DUPLICATE KEY UPDATE`로 제목·요약만 갱신
- 소스 피드 URL 중복 등록 방지도 같은 방식 (`sources.feed_url_hash`)

## D-06. 수집 중복 실행 방지·스케줄링 (F-002)
- `sources.next_crawl_at`: 다음 수집 예정 시각. 스케줄러는 `status IN ('ACTIVE','ERROR') AND next_crawl_at <= NOW()` 조회 → 인덱스 `(status, next_crawl_at)`
- `sources.crawl_lock_until`: 선점 만료 시각. 선점은 원자적 UPDATE 1회
  ```sql
  UPDATE sources SET crawl_lock_until = NOW(3) + INTERVAL 5 MINUTE
  WHERE id = ? AND (crawl_lock_until IS NULL OR crawl_lock_until < NOW(3));
  ```
  affected rows = 1일 때만 수집. 프로세스가 죽어도 5분 뒤 자동 해제. 다중 인스턴스에서도 동작
- 연속 5회 실패: 서버가 `status = 'ERROR'`로 바꾸고 `next_crawl_at`을 늘림. 관리자 재개 시 `ACTIVE`, `consecutive_failures = 0`

## D-07. 피드 커서 페이지네이션 인덱스 (F-010, F-011)
- 정렬 키 `(published_at DESC, id DESC)`, 커서 = 마지막 행의 `(published_at, id)`
  ```sql
  WHERE (published_at, id) < (?, ?) ORDER BY published_at DESC, id DESC LIMIT 20
  ```
  MariaDB는 행 생성자 비교를 range로 잘 못 타는 경우가 있어 `published_at < ? OR (published_at = ? AND id < ?)` 형태 권장 (EXPLAIN으로 확인 예정)
- `posts.published_at`은 NOT NULL. 발행일 없음·미래 발행일은 서버가 저장 시점에 수집 시각으로 대체. 피드 원래 값은 `original_published_at`(nullable)에 보관
- 소스 필터: `idx_posts_source_published (source_id, published_at, id)`
- 소스 유형 필터: `posts.source_type` 비정규화 + `idx_posts_type_published (source_type, published_at, id)`
  - `source_id IN (기업 소스 수십 개)`로 바꾸면 소스별 범위를 합친 뒤 filesort 발생 (기업 글이 절반이면 수만 건 정렬)
  - 비용: 소스 유형 변경 시 해당 소스 글 일괄 UPDATE (관리자 작업, 드묾)
- 태그 필터: `post_tags`에 `published_at` 비정규화 + `idx_post_tags_tag_published (tag_id, published_at, post_id)`
  - 비정규화 이유: `post_tags` → `posts` 조인 후 정렬하면 태그가 인기일수록 정렬 비용 증가. 비정규화하면 인덱스 순서대로 20건만 읽고 끝남
  - 비용: 글 `published_at` 변경 시 `post_tags`도 같은 트랜잭션에서 갱신해야 함 (수집 시 발행일 변경은 드묾)
  - 태그 복수(OR) 필터: 태그별 `LIMIT 20` 서브쿼리를 `UNION`한 뒤 상위 20건 (태그 최대 개수는 API에서 제한 권장, 예: 10개)
  - 소스 복수 필터: `IN`은 `idx_posts_published` 순회 계획이 선택돼 위험함. 소스별 서브쿼리 `UNION ALL` 사용
  - 실측 (discussion 007): 글 10만 건에서 서버 피드 쿼리 15종 DB p95 최대 6.2ms (최악 조합 인기 태그 × 희소 유형). 단일 필터·커서는 깊이와 무관하게 21행. 인덱스 추가 불필요

## D-08. 조회수와 24시간 중복 제외 (F-012, F-013)
- 조회 로그를 행 단위로 쌓지 않음. 24시간 중복 판단용 `post_view_guards (post_id, viewer_key)` 한 행만 유지
  ```sql
  INSERT INTO post_view_guards (post_id, viewer_key, counted_at) VALUES (?, ?, NOW(3))
  ON DUPLICATE KEY UPDATE counted_at = IF(counted_at < NOW(3) - INTERVAL 24 HOUR, NOW(3), counted_at);
  ```
  affected rows가 1(신규) 또는 2(24시간 경과 갱신)면 `posts.view_count = view_count + 1`
- `viewer_key` = `SHA2('u:'||회원ID 또는 'a:'||비회원쿠키ID, 256)` 앞 16바이트. 원본 식별자 미저장
- 보관: `counted_at` 24시간 지난 행은 매시간 배치 삭제 → 테이블 크기는 "하루 고유 조회 수"로 상한
- 인기 글: 기간별 발행 글을 `view_count DESC`로 정렬. 기간 내 글 수가 수천 건이라 정렬 비용 작음. 10분 캐시는 서버 담당
- 일자별 조회 집계 테이블은 MVP에서 두지 않음 (기획이 "기간 내 발행 글의 누적 조회수"라 불필요). 트렌드·기간 내 조회수 기준이 필요해지면 `post_daily_views` 추가
- 탈퇴: 집계 수치(`view_count`)는 유지, guard 행은 해시라 식별 불가 + 24시간 내 소멸

## D-09. 로그·이력 보관 정책
| 테이블 | 보관 | 삭제 방식 | 근거 |
|---|---|---|---|
| `crawl_runs` | 90일 | 일 1회 `started_at` 기준 1,000건씩 반복 삭제 | F-006 |
| `read_histories` | 1년 | 일 1회 `last_read_at` 기준 배치 삭제 | F-041 |
| `post_view_guards` | 24시간 | 매시간 배치 삭제 | D-08 |
| `recommendation_impressions` | 90일 | 일 1회 배치 삭제. 삭제 전 일별 집계 필수 | 002 결정 보충 (pm 승인) |
| `recommendation_daily_stats` | 영구 | 삭제 안 함 | 알고리즘 간 클릭률 비교가 90일을 넘길 수 있음 (002) |
| `refresh_tokens` | 만료 후 7일 | 일 1회 배치 삭제 | 감사용 짧은 보관 |
- 대량 삭제는 한 번에 하지 않고 `LIMIT`으로 나눠 락·undo 로그 부담을 줄임
- 파티셔닝은 MVP에서 사용하지 않음. InnoDB 파티션 테이블은 FK를 쓸 수 없고, 예상 규모(아래)에서 배치 삭제로 충분함

## D-10. 추천 노출·클릭 기록 (F-042)
- `recommendation_impressions`: 추천 응답 1회 = `request_id` 1개, 카드 1장 = 1행. 클릭 시 `clicked_at` 갱신
- 클릭률 = `COUNT(clicked_at) / COUNT(*)` (`algorithm`별, 기간별)
- `algorithm` 컬럼으로 MVP(`TAG_V1`)와 Next(TF-IDF) 비교 가능
- FK 두지 않음: 쓰기량이 가장 많은 테이블이고, 규모가 커지면 월 단위 파티셔닝으로 바꿀 수 있게 미리 FK 제약을 배제함
- 탈퇴 시 `user_id`를 NULL로 갱신 (서버 탈퇴 트랜잭션에서 처리). 클릭률 집계는 유지, 개인 식별 불가
- 추천 점수·사용자 선호도는 저장하지 않고 요청 시 계산 (회원 1만 명, 후보 14일 글 수천 건 규모). 느리면 `user_tag_preferences` 캐시 테이블 도입 검토

## D-10a. 추천 일별 집계 (`recommendation_daily_stats`, 영구 보관)
- 키: PK `(stat_date, algorithm)`. 값: `impression_count`, `click_count`, `request_count`(= 고유 `request_id` 수). 개인 식별 정보 없음
- `stat_date`는 `shown_at`의 UTC 날짜. 클릭은 노출 다음 날 들어올 수 있어 노출 날짜 기준으로 귀속
- 집계 배치 (server, 일 1회): 최근 7일치를 다시 계산해 덮어씀 → 늦은 클릭 반영, 재실행해도 결과 같음(멱등)
  ```sql
  INSERT INTO recommendation_daily_stats (stat_date, algorithm, impression_count, click_count, request_count)
  SELECT DATE(shown_at), algorithm, COUNT(*), COUNT(clicked_at), COUNT(DISTINCT request_id)
  FROM recommendation_impressions
  WHERE shown_at >= ? AND shown_at < ?
  GROUP BY DATE(shown_at), algorithm
  ON DUPLICATE KEY UPDATE impression_count = VALUES(impression_count),
    click_count = VALUES(click_count), request_count = VALUES(request_count);
  ```
  `idx_rec_impressions_shown (shown_at, algorithm)` 범위 스캔
- 원본 삭제 배치는 반드시 집계 배치 뒤에 실행. 원본 90일 > 재집계 7일이라 집계가 끝난 날짜만 삭제됨
- 규모: 알고리즘 2~3개 × 365일 → 연 1,000행 수준. 영구 보관 비용 무시 가능

## D-11a. 소스별 최근 7일 신규 글 수 (A-01)
- `crawl_runs.new_post_count`를 `idx_crawl_runs_source_started` 범위로 합산. `posts` 스캔 없음 (server 제안 채택)
- `crawl_runs` 보관 90일 > 7일이라 값 손실 없음

## D-11. 태그 사용 글 수 (A-04, 인기 태그)
- `tags`에 카운트 컬럼 두지 않음. `post_tags`의 `idx_post_tags_tag_published` 선두 컬럼으로 `GROUP BY tag_id` 계산
- 이유: 글 저장마다 태그 행 갱신이 생기면 인기 태그 행에 락 경합. 관리자 화면·결과 없음 화면 용도라 서버 캐시로 충분

## D-12. 예상 데이터 규모 (설계 기준)
| 테이블 | 행 수 | 근거 |
|---|---|---|
| sources | ~100 | 시드 30곳+ |
| posts / post_search | 100,000 | 비기능 요구 |
| post_tags | ~400,000 | 글당 평균 4개 |
| tags / tag_aliases | ~200 / ~600 | 시드 100개+ |
| users | 10,000 | 비기능 요구 |
| bookmarks | ~500,000 | 회원당 평균 50 |
| read_histories | ~2,000,000 | 회원당 평균 200 (1년) |
| crawl_runs | ~80,000 | 35곳 × 24회 × 90일 |
| recommendation_impressions | ~5,000,000 | 일 60,000 노출 × 90일 (가정) |
| recommendation_daily_stats | ~1,000/년 | 일 × 알고리즘 수 |

## D-13. 초기 데이터 (시드)
- 소스·태그 사전 시드는 개발용이자 운영 초기 데이터 (F-001 소스 30곳+, F-005 태그 100개+)
- 소스 시드는 F-001 등록 검증을 거치지 않으므로 dba가 사전 검증함 (응답 200, RSS/Atom, 글 1건 이상). 결과는 `db/README.md`
- 시드는 유니크 키 기준 upsert로 작성해 재실행 안전하게 유지
- 글 10만 건·회원 1만 명 대량 시드(성능 측정용)는 M3 전에 별도 생성기로 작성 예정

## D-14. 피드 카테고리 보관 위치와 FULLTEXT 테이블 변경 비용
- `post_search.feed_categories VARCHAR(500) NULL` (`0008`, 005 결정). 재태깅이 수집 때와 같은 입력(제목·카테고리·요약)을 쓰기 위함. 백필 없음
- `posts`가 아닌 `post_search`에 둔 이유: D-04와 같음. 피드 목록 조회에 안 쓰는 컬럼이라 `posts` 행 크기 유지
- 적용 중 확인한 제약: FULLTEXT 인덱스가 있는 InnoDB 테이블은 `ADD/DROP COLUMN`에 `INSTANT`, `INPLACE` 모두 불가 → `ALGORITHM=COPY`만 가능
  - COPY는 테이블과 FULLTEXT 인덱스 2개를 다시 만들고, 그동안 쓰기가 막힘
  - 실측: 2,383행 0.36초, **10만 행 277초** (`devfeed_perf` 복사 테이블, 2026-11-19). 운영 규모에서는 수 분간 수집 중단
- 운영 규칙: `post_search` 스키마 변경은 최소화하고 수집이 적은 시간에 실행. 앞으로 검색과 무관한 컬럼은 `post_search`에 추가하지 않고 `posts`(INSTANT 가능)나 별도 테이블에 둠

## D-15. 검색 필터·정렬: `posts` 커버링 인덱스 (`0009`, discussion 010)
- 문제: FULLTEXT 매칭이 수만 건인 흔한 검색어에서 매칭 행마다 `posts` 클러스터드 행(약 800B)을 조회해 p95 200~475ms
- 결정: `posts.idx_posts_search_filter (id, published_at, source_id, source_type)` 추가, 검색 조인은 `FORCE INDEX`로 이 인덱스만 읽음
  - 10만 건 약 3MB라 항상 버퍼 풀에 상주. 필터·최신순 포함 p95 29~86ms
  - 온라인 생성(`INPLACE, LOCK=NONE`) 10만 행 56ms. 쓰기 경로·동기화 변경 없음
- 기각: `post_search`에 `published_at`, `source_id` 비정규화 (server B안). FULLTEXT 테이블 COPY 변경 277초 + 쓰기 잠금(D-14), 측정상 개선 미미(p95 180~343ms)
- 한계: 선두 컬럼이 PK와 같은 인덱스라 옵티마이저가 자동 선택하지 않음 (힌트 없이 PRIMARY, 215ms). 쿼리 힌트 의존. 인덱스명 변경 시 서버 쿼리도 함께 바꿔야 함
- 필터 없는 관련도 검색은 조인 없이 `post_search`만으로 상위 20건을 고른 뒤 카드 조회
- 상태: 채택 (010, 2026-11-19). `devfeed`·`devfeed_perf` 적용 완료. 버퍼 풀(128MB) 증설은 M6에서 재검토
- 결과 (server API 측정, 글 10만 건, 캐시 끔): c=1 전체 p95 923ms → 건수 상한 301ms → 건수 상한 + 0009 **94ms**. c=10 p95 497ms(참고). 남은 느린 질의는 결과 많은 다중 bigram 관련도 계산 80~100ms

## D-16. 탈퇴 처리와 잔존 검사 (012)
- 탈퇴 트랜잭션 순서: `recommendation_impressions.user_id = NULL` → `post_view_guards`의 회원 `viewer_key` 행 삭제 → `users` 삭제 (나머지 4개 테이블 CASCADE)
- `post_view_guards`는 24시간 소멸을 기다리지 않고 즉시 삭제 (D-08 보완). `viewer_key` 단독 인덱스는 없지만 하루치 크기라 전체 스캔 허용
- 실측 (`devfeed_perf`, 롤백): 읽은 기록 400건 회원 탈퇴 78ms, 7개 테이블 잔존 0
- `db/queries/withdrawal-check.sql`은 server e2e가 그대로 읽는 계약 파일임. 회원 연결 테이블을 추가·변경하면 이 파일에 같은 커밋으로 반영하고 server에 알림

