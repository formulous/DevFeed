# 스키마 결정 기록

- 작성: dba
- 상태: v1.4 (M10, 2026-11-22). D-21·D-22 (026), D-23 (027), D-24 (029) 추가. 각 결정의 합의 discussion 번호를 본문에 표기. D-18~D-20 추가 (021)
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
- 결정 (002 확정)
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
- `0010`에서 세 인덱스 모두 `kind`를 앞(태그는 `tag_id` 다음)에 넣은 인덱스로 교체 (D-18)
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
- `tags`에 카운트 컬럼 두지 않음. `post_tags`의 `idx_post_tags_tag_kind_published` 선두 컬럼으로 `GROUP BY tag_id` 계산 (`0010` 이후 블로그만 셀 때 `WHERE kind = 'BLOG'`, 10만+4만 건 18ms)
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
- `0012`(026) 이후 순서: 위 순서 앞에 좋아요(카운터 감소 → 행 삭제)·댓글(카운터 감소 → 답글 삭제 → 자리 표시 처리 → 빈 자리 표시 정리) 처리 추가 (`db/queries/reactions.sql`). `post_likes`·`comments`의 `user_id` FK는 CASCADE가 아닌 RESTRICT라 이 처리를 빠뜨리면 `users` 삭제가 실패함 (카운터 어긋남·댓글 원문 잔존 방지)
- `db/queries/withdrawal-check.sql`은 server e2e가 그대로 읽는 계약 파일임. 회원 연결 테이블을 추가·변경하면 이 파일에 같은 커밋으로 반영하고 server에 알림

## D-17. 백업과 복원 (014)
- 방식: `mariadb-dump --single-transaction --hex-blob` 논리 백업, gzip. InnoDB 잠금 없이 수집 중에도 일관된 스냅샷
  - 생성 컬럼(`*_hash`)은 덤프 INSERT에 값이 들어 있지만, 덤프가 비엄격 `sql_mode`로 실행돼 그 값은 경고(1906)와 함께 무시되고 복원 시 재계산됨 (검증에서 불일치 0). 복원을 엄격 모드 클라이언트로 따로 돌리면 오류가 날 수 있어 `restore.sh` 사용 권장. FULLTEXT 인덱스도 복원 시 재생성
- 주기·보관: 매일 04:30 KST, 저장소 밖 `~/backups/devfeed`, 14일 보관 후 자동 삭제 (launchd `org.devfeed.backup`)
- 크기: 글 2,383건 기준 924KB, 0.7초. 글 10만 건이면 약 40MB·수십 초로 예상 → 물리 백업(mariabackup)은 필요 없음
- 복원 검증 (2026-11-19): 임시 DB 복원 후 행 수·해시·FULLTEXT·인덱스·FK 전부 일치
- 한계: 같은 맥미니 디스크에만 보관 → 디스크 고장 시 함께 유실. 외부 저장소 복사는 운영 확장 시 검토
- 개인정보: 탈퇴 회원 데이터가 백업에 최대 14일 남음 (개인정보 안내에 명시 필요, pm)
- 버퍼 풀: **128MB 유지 확정** (014, pm). `devfeed` 6MB라 증설 효과 없음. 기준: `posts`+`post_search`가 버퍼 풀의 70%를 넘으면 재검토


## D-18. 소스 종류·지역과 `kind` 비정규화 (`0010`, 021)
- `sources.kind ENUM('BLOG','SECURITY_NEWS')`, `sources.region ENUM('DOMESTIC','OVERSEAS')` (뉴스만, CHECK로 강제)
- `posts.kind`, `post_tags.kind` 비정규화 (`source_type`·`published_at`과 같은 방식). `kind`는 등록 후 변경 불가라 동기화 갱신 없음. 정합성은 `db/queries/feed.sql` 끝의 검사 쿼리로 확인
  - 이유: 보안 뉴스가 블로그보다 빨리 쌓임 (RSS 실측 하루 약 35~55건, 블로그 수 건). 블로그 목록에서 뉴스를 조인으로 거르면 LIMIT 21을 채우려고 뉴스 행을 계속 건너뜀. 특히 `보안` 분류 태그는 뉴스 비중이 80% 이상이 됨
  - 복합 FK `(source_id, kind) → sources(id, kind)`는 기각: 인덱스 2개 추가 대비 이득 작음 (kind 불변)
- 인덱스 교체: `idx_posts_published` → `idx_posts_kind_published (kind, published_at, id)`, `idx_posts_type_published` → `idx_posts_kind_type_published (kind, source_type, published_at, id)`, `idx_post_tags_tag_published` → `idx_post_tags_tag_kind_published (tag_id, kind, published_at, post_id)`
  - 기존 인덱스는 같은 마이그레이션에서 제거. `kind` 조건 없는 옛 쿼리는 filesort로 바뀌지만 운영 규모(2.4천 건)에선 영향 없음 → server 배포와 같은 시점에 적용
- 보안 뉴스 `source_type`은 `COMPANY`로 저장 (NOT NULL 유지, server 제안). 기업 탭은 `kind = 'BLOG'` 조건이 함께 있어 섞이지 않음
- 지역 필터는 `posts`에 `region` 두지 않음. 출처 6곳이라 지역 → 출처 ID 목록 → 소스별 `UNION ALL` (D-07 방식)
- 적용 비용 (`devfeed_perf` 10만 건): 컬럼 `INSTANT`, 인덱스 교체 `INPLACE, LOCK=NONE` 합계 1초. up → down → up 통과

## D-19. 분야(field) 필터: 테이블 없이 태그 분해 (021)
- 분야 → 분류 묶음은 서버 상수 (server 결정). DB에 `fields`·`post_fields` 테이블 두지 않음
  - `post_fields` 비정규화 검토했으나 기각: 태그 분해만으로 충분히 빠르고, 분류 변경·재태깅 때 갱신할 테이블이 늘어남
- 쿼리: 분야 태그마다 `post_tags` 범위 스캔 `LIMIT 21`을 `UNION` → 정렬. 다른 필터(태그·소스·인기)가 있으면 그쪽이 드라이브하고 분야는 `EXISTS (post_tags PK)`
- 측정 (`devfeed_perf` 블로그 10만 + 합성 보안 뉴스 4만, `db/perf/measure_field.py`, DB 시간 p95)
  | 쿼리 | p95 | 읽은 행 |
  |---|---|---|
  | 분야 7개 단독 (태그 6~28개) | 0.07~0.29ms | 248~1,142 |
  | 분야 BACKEND + 개인 탭 (최악) | 5.9ms | 20,084 |
  | 분야 + 태그 / + 개인 소스 2개 | 0.11 / 0.38ms | 463 / 1,869 |
  | 인기 MONTH + 분야 / YEAR + 분야 | 4.3 / 3.6ms | 5,746 / 11,184 |
  | 인기 YEAR (분야 없음) | 40.6ms | 55,514 (기존과 같은 기간 스캔, 서버 캐시) |
  | 보안 뉴스 전체 / 국내 / 출처 1곳 | 0.01 / 0.03 / 0.01ms | 21 / 126 / 21 |
  | 추천 후보 14일 (태그 30개) | 0.88ms | 3,572 |
  - 수용 기준 p95 300ms 대비 여유 큼. API 측정은 server 구현 후 `server/perf/`에서 함께 확인
- 주의: 분야 태그 수가 크게 늘면(분야당 100개+) `UNION` 서브쿼리 수만큼 비용 증가 → 그때 `post_fields` 재검토

## D-20. 보안 뉴스 저장 규칙과 용량 (021)
- 저장 (server 수집 단계에서 보장): 요약 150자 이하, `thumbnail_url` NULL, `post_search` 행 만들지 않음 → 검색 제외가 쿼리 조건 없이 보장됨. Next에서 검색 포함 시 재색인으로 채움
  - 영향: 뉴스는 `post_search.feed_categories`도 없어서 재태깅 시 제목·요약만 씀 (005 손실과 같은 성격, 뉴스 태그는 표시용이라 허용)
- 용량: RSS 실측 하루 약 35~55건 → 연 1.3만~2만 건, 행+인덱스 약 1.5KB → 연 30MB 이하. `post_search`가 없어 블로그 글보다 가벼움
  - 보관 기한은 지금 두지 않음. D-17 버퍼 풀 기준(`posts`+`post_search` 70%)이나 뉴스 10만 건 도달 시 pm과 보관 기한 재검토 (북마크된 글은 남기는 방식 후보)
- 시드: `db/seeds/003_security_news_sources.sql` 6곳 (국내 3·해외 3, 주기 30분, KISA 60분). KISA `B0000127`(보고서/가이드)은 제외 (server 의견 동의: 갱신 수 주 단위, description 없음)
  - 운영 `devfeed` 시드 등록은 server의 뉴스 수집 규칙 배포 후. 먼저 넣으면 현재 서버가 블로그 규칙(썸네일·300자)으로 수집함

## D-21. 좋아요·댓글 수: `posts` 카운터 컬럼 (`0012`, 026)
- `posts.like_count`, `posts.comment_count` (`INT UNSIGNED`, `INSTANT` 추가). 쓰기와 같은 트랜잭션에서 증감 (server 제안 동의)
  - 카드 조립이 이미 `posts`를 PK로 읽으므로 목록 API에 조인·집계가 늘지 않음 → 피드·검색 p95 영향 없음 (카드 20건 0.03ms)
  - 기각: 별도 `post_counters` 테이블 (조인 1회 추가, 이득은 행 잠금 분리뿐인데 글당 쓰기 빈도가 낮음), 조회 시 `COUNT(*)` 집계 (목록마다 20건 집계)
- 멱등: 좋아요는 PK `(user_id, post_id)`에 `INSERT IGNORE`/`DELETE`, 영향 행 1일 때만 카운터 증감. 실측: 같은 회원·글 20개 동시 요청(켜기·끄기 섞음, 켜기만) 후 행 0/1과 카운터 일치
- 잠금 순서 (server 실측 반영): 회원 행(댓글 작성만) → 글 행 `FOR UPDATE` → 부모 댓글 → 댓글. `post_likes` INSERT의 FK 검사가 글 행에 공유 잠금을 잡아, 같은 글 카운터를 동시에 올리는 두 트랜잭션이 데드락 남 → 글 행 배타 잠금을 먼저 잡아 같은 글 쓰기만 직렬화. 재측정: 회원 4명 × 켜기·끄기 20개 동시 3회, 오류 0·카운터 일치
- `comment_count` 변화 규칙: 작성 +1, `VISIBLE` 삭제 −1, 숨김 −1, 숨김 해제 +1, 수정·자리 표시 정리 0
- 정합성 검사: `db/queries/reactions.sql` 끝 6항목 (좋아요·댓글·답글 수 불일치, 2단계 이상 답글, 빈 자리 표시, `DELETED` 답글). 합성 데이터 전체 0
- `UNSIGNED`라 카운터가 0 밑으로 내려가면 엄격 모드에서 오류 → 버그를 조용히 숨기지 않음

## D-22. 댓글 트리·삭제·숨김 (`0012`, 026)
- 1단계 답글: `parent_id`는 항상 최상위 댓글 (답글의 답글은 server가 부모로 올림). DB CHECK로 행 간 조건을 못 걸어 정합성 검사로 확인
- `reply_count` = 남아 있는 답글 행 수(VISIBLE+HIDDEN). 숨긴 답글도 "관리자가 숨긴 댓글이에요"로 자리를 차지하므로 포함
- 삭제: 답글은 항상 행 삭제, 댓글은 `reply_count > 0`이면 `DELETED` 자리 표시(본문·작성자 NULL), 아니면 행 삭제. 자리 표시의 마지막 답글이 지워지면 자리 표시도 삭제
- 본문은 원문 그대로 저장 (이스케이프·HTML 제거 안 함). XSS 방지는 client 텍스트 렌더링 책임. `VARCHAR(1000)`이 1,000자(바이트 아님)를 DB에서 한 번 더 막음
- 속도 제한은 `idx_comments_user_created`로 DB에서 셈. 한계: 행 삭제된 댓글은 세지 않아 작성·삭제 반복으로 하루 200개를 넘길 수 있음 (1분 5개는 유지됨). 필요하면 Next에서 작성 로그로 보완
- 측정 (`devfeed_perf`, 좋아요 50만·댓글 10만·답글 5만, 한 글에 댓글 2,000개, `db/perf/measure_reactions.py`, DB p95): 댓글 첫 페이지 0.07ms, 1,000개 뒤 커서 0.01ms, 답글 3개 × 부모 20개 0.14ms, 작성자 80명 0.47ms, 속도 제한 0.00ms, `likedByMe` 0.03ms
- 탈퇴: 댓글 15개·좋아요 50개 회원 처리 109ms, 잔존 0, 정합성 6항목 0 (롤백 측정)
- 용량: 댓글 1건 평균 약 0.5KB(본문+인덱스), 10만 건 50MB 이하. 보관 기한 없음 (글 단위 데이터)

## D-23. 패스키·WebAuthn 챌린지 (`0013`, 027)
- 패스키 `user_passkeys`: credential id로 찾는 테이블. `credential_id VARBINARY(1023)` 그대로 UNIQUE (키 1,025바이트, InnoDB 한도 3,072 안). 해시 컬럼(D-05 방식)은 길이가 보통 16~64바이트라 이득 없어 기각
  - 저장하는 것은 공개키·서명 횟수·메타데이터뿐. 생체 정보·개인키는 없음 (S-11 안내 근거)
  - 탈퇴: FK CASCADE (카운터 같은 파생 값이 없어 D-16 RESTRICT 대상 아님). `withdrawal-check.sql`에 두 테이블 추가
- 서명 횟수: `UPDATE ... WHERE id = ? AND (? > sign_count OR (? = 0 AND sign_count = 0))` 영향 행 0이면 거부 → 역행과 동시 재제출 모두 한 문장으로 차단
- 10개 제한: 등록 트랜잭션에서 `users` 행 `FOR UPDATE` 후 개수 확인 (026 잠금 순서와 같이 회원 행 먼저)
- user handle: `users.webauthn_handle BINARY(32)` 랜덤값 (server 제안 `users.id` 대신)
  - 이유: 표준이 user handle을 식별 정보 없는 랜덤값으로 권장. 순번 id를 넣으면 인증기(동기화되는 비밀번호 관리자 포함)에 가입 순서·회원 수가 남음. 컬럼 1개(`INSTANT`)와 첫 등록 옵션 발급 때 한 번 채우는 비용뿐 (server 구현. 등록을 끝내지 않아도 값은 유지돼 다음 시도에 같은 handle)
  - 로그인은 credential id로 찾고, 응답의 userHandle이 그 회원의 `webauthn_handle`과 같은지만 확인
- 챌린지 `webauthn_challenges` (server 제안 채택): 원문 대신 SHA-256만 저장, `DELETE` 영향 행으로 1회 소비·만료 판정, 발급 때 만료 행 100개씩 정리
  - 메모리 대비 장점: 재시작에도 유지, 원자적 1회 소비가 DB 한 문장. 비용: 로그인 시도마다 쓰기 2회 (IP 속도 제한 분당 10이라 최대 분당 수십 행)
  - 별도 `challengeId` 없이 clientDataJSON의 challenge 값 자체가 키 (client 제안의 `challengeId`는 챌린지 문자열을 그대로 쓰면 됨)

## D-24. 활동 점수 원장과 `users.score` (`0014`, 029)
- 원장 `score_events` PK `(user_id, kind, ref_id)` + `users.score` 캐시 (server 제안·pm 승인). 등급은 저장하지 않고 server 상수로 계산
  - 원장을 둔 이유: 읽은 기록이 지워져도 읽기 점수 유지, 같은 글 1회·회수·복구를 행 단위로 판단, 정합성 검사 가능
  - `users.score`를 둔 이유: 댓글 작성자 등급을 목록마다 원장 합계로 구하지 않음 (댓글 페이지 + 등급 0.03ms)
  - 수치 4개(좋아요·댓글·읽은 글·북마크)는 카운터 없이 회원 범위 `COUNT` (활동 많은 회원 0.05ms) → 동기화할 값이 늘지 않음
- 규칙 (pm 결정): 읽기 +1 하루 30점(초과분은 행 남기지 않음 → 다른 날 처음 읽을 때 적립 가능), 좋아요 +2 취소 시 행 삭제·회수, 댓글 +5 하루 처음 10개(회수된 행도 셈, 11번째부터 0점 행), 삭제·숨김 `revoked_at`, 숨김 해제 복구. 하루 = KST 자정
- 잠금 순서: 회원 행 → 글 행 → 부모 댓글 → 댓글 → 원장. 좋아요도 회원 행 먼저로 변경 (`reactions.sql` 갱신, 026 D-21 보완)
- 쓰기 규칙: 점수 증감은 원장 쓰기의 영향 행 수로만 판단 (`SELECT ... INTO`가 행을 못 찾으면 변수가 이전 값으로 남으므로 그 값만 믿지 않음)
- 백필 (`db/queries/score.sql`): server가 원장 쓰기를 시작한 직후 1회 실행. `INSERT IGNORE`라 그 사이 server가 만든 행과 겹쳐도 안전, 하루 한도 미적용(pm 결정). 실측: 255만 행 22초
- 정합성 검사 6항목: 점수 불일치, 원장 없는 좋아요·좋아요 없는 원장, 댓글 상태와 회수 불일치, 지워진 댓글 미회수, 원장 없는 댓글. 백필 후 0
- 용량 (한계점): 행당 약 145B(인덱스 포함). 성능 DB 규모(회원 1만, 읽기 190만)에서 255만 행·354MB → 버퍼 풀(128MB)보다 큼. 지금 운영 규모(회원 3명)는 무시할 수준
  - **채택 (pm, 2026-11-22)**: READ 행은 읽은 기록 보관과 같이 1년 지나면 회원당 `ARCHIVE` 1행으로 접음 (점수 변화 없음). 대가: 1년 넘은 글을 다시 읽으면 +1 다시 적립 가능 (하루 30점 한도 안). server 일일 정리 작업에서 접기 INSERT와 DELETE를 한 트랜잭션으로 실행
  - 실측 (`devfeed_perf`, 롤백): READ 21만 행 접기 2.6초, 회원 점수 합 불변, 재실행 시 변화 0, 정합성 0. 평소에는 하루치만 만료돼 수십 ms 예상
  - 조회는 회원 범위만 읽어서 전체 크기가 커져도 쿼리 속도는 유지됨. 영향은 버퍼 풀·백업 크기
