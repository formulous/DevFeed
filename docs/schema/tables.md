# 테이블 명세

- 작성: dba
- 상태: v1.2 (M8, 2026-11-21). 마이그레이션 0001~0012 기준. `0012`는 `devfeed_perf`·`devfeed_test` 적용, `devfeed` 적용은 사용자 확인 후. `devfeed`·`devfeed_perf`·`devfeed_test` 적용 완료
- 공통: InnoDB, utf8mb4_unicode_ci, 시간은 `DATETIME(3)` UTC, PK `BIGINT UNSIGNED AUTO_INCREMENT` (D-01)
- 결정 번호(D-xx)는 `decisions.md` 참고

## sources — `0001`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| name | VARCHAR(100) | NOT NULL | 검색 토큰에도 포함 (D-04) |
| site_url | VARCHAR(2048) | NOT NULL | 블로그 URL |
| feed_url | VARCHAR(2048) | NOT NULL | RSS/Atom URL |
| feed_url_hash | BINARY(32) | STORED 생성, UK | `UNHEX(SHA2(feed_url,256))`. 중복 등록 방지. 서버는 쓰지 않음 (D-05) |
| source_type | ENUM('COMPANY','PERSONAL') | NOT NULL | 보안 뉴스는 `COMPANY` 고정 저장, 화면에서 안 씀 (021) |
| kind | ENUM('BLOG','SECURITY_NEWS') | NOT NULL, 기본 BLOG | `0010`. 등록 후 변경 불가 (서버 보장). 기존 36곳 BLOG (D-18) |
| region | ENUM('DOMESTIC','OVERSEAS') | NULL | `0010`. 보안 뉴스만 필수, 블로그는 NULL (`ck_sources_kind_region`) |
| logo_url | VARCHAR(2048) | NULL | |
| crawl_interval_min | SMALLINT UNSIGNED | NOT NULL, 기본 60, CHECK ≥ 30 | F-001 |
| status | ENUM('ACTIVE','ERROR','INACTIVE') | NOT NULL, 기본 ACTIVE | 삭제 대신 INACTIVE (D-02) |
| consecutive_failures | SMALLINT UNSIGNED | NOT NULL, 기본 0 | 5회 → ERROR |
| next_crawl_at | DATETIME(3) | NOT NULL, 기본 CURRENT_TIMESTAMP(3) | 등록 즉시 수집 대상. 시드 누락 방지 (003) |
| crawl_locked_until | DATETIME(3) | NULL | 원자적 선점 (D-06) |
| last_crawled_at | DATETIME(3) | NULL | |
| last_success_at | DATETIME(3) | NULL | A-01 마지막 성공 |
| etag | VARCHAR(255) | NULL | 조건부 요청 |
| last_modified | VARCHAR(64) | NULL | HTTP 헤더 원문 그대로 |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

인덱스
- `uk_sources_feed_url_hash (feed_url_hash)`
- `idx_sources_status_next_crawl (status, next_crawl_at)`: 스케줄러 1분 tick 조회

제약
- `ck_sources_kind_region`: `(kind = 'BLOG' AND region IS NULL) OR (kind = 'SECURITY_NEWS' AND region IS NOT NULL)`

## crawl_runs — `0001`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| source_id | BIGINT UNSIGNED | FK → sources | 소스는 삭제 없음 → 기본 RESTRICT |
| trigger_type | ENUM('SCHEDULED','MANUAL') | NOT NULL | 관리자 즉시 수집 구분 |
| result | ENUM('RUNNING','SUCCESS','NOT_MODIFIED','FAILURE') | NOT NULL, 기본 RUNNING | NOT_MODIFIED는 성공 취급 (pm 결정) |
| started_at | DATETIME(3) | NOT NULL | |
| finished_at | DATETIME(3) | NULL | 소요 시간 = finished - started |
| attempt_count | TINYINT UNSIGNED | NOT NULL, 기본 1 | 재시도 포함 시도 횟수 |
| http_status | SMALLINT UNSIGNED | NULL | |
| fetched_count / new_post_count / updated_post_count | SMALLINT UNSIGNED | NOT NULL, 기본 0 | 7일 신규 글 수 = new_post_count 합 (D-11a) |
| error_message | VARCHAR(1000) | NULL | 서버가 1000자로 자름 |

인덱스
- `idx_crawl_runs_source_started (source_id, started_at)`: 소스 상세 최근 50건, 7일 합산 (역순 스캔)
- `idx_crawl_runs_started (started_at)`: 오늘 요약, 90일 삭제 배치

## tags — `0002`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| name | VARCHAR(50) | NOT NULL, UK | 표시명 (`Kubernetes`). 대소문자 무시 유일 |
| slug | VARCHAR(60) ascii | NOT NULL, UK | URL 쿼리용 (`kubernetes`) |
| category | VARCHAR(30) | NULL | A-04 분류. 값 변경 잦을 수 있어 ENUM 대신 VARCHAR |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

인덱스: `uk_tags_name (name)`, `uk_tags_slug (slug)`

## tag_synonyms — `0002`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| tag_id | BIGINT UNSIGNED | FK → tags CASCADE | |
| synonym | VARCHAR(100) | NOT NULL, UK | 동의어 하나는 한 태그에만 속함. 콜레이션상 대소문자 무시 |
| created_at | DATETIME(3) | NOT NULL | |

인덱스: `uk_tag_synonyms_synonym (synonym)`, `idx_tag_synonyms_tag (tag_id)` — FK 인덱스, 태그별 동의어 조회

## posts — `0003`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | 커서 동률 해소 키 |
| source_id | BIGINT UNSIGNED | FK → sources | |
| source_type | ENUM('COMPANY','PERSONAL') | NOT NULL | 비정규화. 유형 필터 + 커서 (D-07) |
| kind | ENUM('BLOG','SECURITY_NEWS') | NOT NULL, 기본 BLOG | `0010`. `sources.kind` 비정규화. 블로그 전용 목록과 보안 뉴스 탭 분리 (D-18) |
| guid | VARCHAR(1024) | NULL | 피드 guid/id |
| guid_hash | BINARY(32) | STORED 생성 | guid NULL이면 NULL (D-05) |
| url | VARCHAR(2048) | NOT NULL | 서버가 정규화한 원문 URL |
| url_hash | BINARY(32) | STORED 생성, UK | 중복 판단 1순위 키 |
| title | VARCHAR(500) | NOT NULL | |
| summary | VARCHAR(300) | NULL | 말줄임표 포함 300자 이하. 본문 미저장 (F-004). 보안 뉴스는 150자 이하 (D-20) |
| thumbnail_url | VARCHAR(2048) | NULL | 보안 뉴스는 항상 NULL (D-20) |
| published_at | DATETIME(3) | NOT NULL | 없음·미래면 수집 시각으로 대체해 저장 |
| original_published_at | DATETIME(3) | NULL | 피드 원래 발행일 |
| view_count | INT UNSIGNED | NOT NULL, 기본 0 | 24시간 중복 제외 후 +1 (D-08) |
| like_count | INT UNSIGNED | NOT NULL, 기본 0 | `0012`. `post_likes` 행 수. 좋아요 쓰기와 같은 트랜잭션에서 증감 (D-21) |
| comment_count | INT UNSIGNED | NOT NULL, 기본 0 | `0012`. `VISIBLE` 댓글+답글 수. 삭제·숨김 제외 (D-21) |
| created_at | DATETIME(3) | NOT NULL | 수집 시각 |
| updated_at | DATETIME(3) | NOT NULL | 재수집 갱신 시각 |

인덱스
- `uk_posts_url_hash (url_hash)`, `uk_posts_source_guid_hash (source_id, guid_hash)`: 중복 0건 보장
- `idx_posts_kind_published (kind, published_at, id)`: `0010`. 최신 피드·보안 뉴스 탭 커서, 인기 글 기간 범위 (기존 `idx_posts_published` 대체)
- `idx_posts_source_published (source_id, published_at, id)`: 소스 필터 커서. FK 인덱스 겸용
- `idx_posts_kind_type_published (kind, source_type, published_at, id)`: `0010`. 기업·개인 탭 커서 (기존 `idx_posts_type_published` 대체)
- `idx_posts_search_filter (id, published_at, source_id, source_type)`: `0009`. 검색 FULLTEXT 결과 조인 시 커버링 인덱스로 필터·최신순 처리. `FORCE INDEX` 필요 (D-15)

## post_tags — `0003`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| post_id | BIGINT UNSIGNED | PK, FK → posts CASCADE | |
| tag_id | BIGINT UNSIGNED | PK, FK → tags CASCADE | 태그 삭제 시 연결만 삭제 |
| tag_rank | TINYINT UNSIGNED | NOT NULL, CHECK 1~5 | 카드 태그 노출 순서, 제목 등장 우선 (F-005). `rank`는 예약어 |
| published_at | DATETIME(3) | NOT NULL | `posts.published_at` 비정규화 (D-07) |
| kind | ENUM('BLOG','SECURITY_NEWS') | NOT NULL, 기본 BLOG | `0010`. `posts.kind` 비정규화. 태그·분야 필터에서 보안 뉴스 건너뛰기 방지 (D-18) |

인덱스
- PK `(post_id, tag_id)`: 글의 태그 조회 (카드 렌더링)
- `idx_post_tags_tag_kind_published (tag_id, kind, published_at, post_id)`: `0010`. 태그·분야 필터 커서, 태그별 사용 글 수, 추천 후보 (D-11, D-19). 기존 `idx_post_tags_tag_published` 대체

## post_search — `0003`
- 보안 뉴스 글은 행을 만들지 않음 → 검색에서 쿼리 조건 없이 제외 (D-20)

| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| post_id | BIGINT UNSIGNED | PK, FK → posts CASCADE | 1:1 |
| title_tokens | TEXT | NOT NULL | 제목 토큰 (D-03 규칙) |
| body_tokens | TEXT | NOT NULL | 요약 + 태그명·동의어 + 소스 이름 토큰 |
| feed_categories | VARCHAR(500) | NULL | `0008`. 피드 카테고리 원문, `\n` 구분, 카테고리 단위로 500자 이내. 재태깅 입력용, FULLTEXT 대상 아님 (005) |
| updated_at | DATETIME(3) | NOT NULL | |

인덱스
- `ft_post_search_title (title_tokens)`: 제목 가중치
- `ft_post_search_all (title_tokens, body_tokens)`: 전체 관련도
- 필요 서버 설정: `innodb_ft_min_token_size=2`, `innodb_ft_enable_stopword=OFF` (`db/conf/devfeed.cnf`)

## post_likes — `0012`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| user_id | BIGINT UNSIGNED | PK, FK → users (RESTRICT) | 탈퇴 시 server가 카운터 감소 후 삭제 (D-16) |
| post_id | BIGINT UNSIGNED | PK, FK → posts CASCADE | |
| created_at | DATETIME(3) | NOT NULL | |

인덱스
- PK `(user_id, post_id)`: 멱등 토글(`INSERT IGNORE`·`DELETE` 영향 행 수), `likedByMe` 카드 ID 조회
- `idx_post_likes_post (post_id)`: FK, 글별 재계산(정합성 검사)

## comments — `0012`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | 작성 순서 = 커서 키 |
| post_id | BIGINT UNSIGNED | FK → posts CASCADE | 답글도 부모와 같은 글 |
| parent_id | BIGINT UNSIGNED | NULL, FK → comments CASCADE | NULL이면 댓글, 값이 있으면 답글. 1단계만 (server 보장, 정합성 검사) |
| user_id | BIGINT UNSIGNED | NULL, FK → users (RESTRICT) | `DELETED` 자리 표시만 NULL |
| body | VARCHAR(1000) | NULL | 원문 텍스트 그대로(이스케이프 안 함), 1~1,000자. `DELETED`면 NULL |
| status | ENUM('VISIBLE','HIDDEN','DELETED') | NOT NULL, 기본 VISIBLE | `DELETED`는 답글 있는 댓글의 자리 표시 |
| reply_count | INT UNSIGNED | NOT NULL, 기본 0 | 남아 있는 답글 행 수(VISIBLE+HIDDEN). "답글 N개 더보기", 자리 표시 판단 |
| edited_at | DATETIME(3) | NULL | "(수정됨)" |
| hidden_at / hidden_by | DATETIME(3) / BIGINT UNSIGNED | NULL, `hidden_by` FK → users SET NULL | 관리자 숨김. `HIDDEN`일 때만 `hidden_at` 있음 |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

제약
- `ck_comments_status_body`: `DELETED` ↔ `body`·`user_id` NULL, 그 외는 둘 다 필수·1자 이상
- `ck_comments_hidden`: `status = 'HIDDEN'` ↔ `hidden_at IS NOT NULL`

인덱스
- `idx_comments_post_parent (post_id, parent_id, id)`: 글의 댓글 오래된 순 커서 (`parent_id IS NULL AND id > ?`)
- `idx_comments_parent (parent_id, id)`: 답글 처음 3개(부모 20개 한 번에 `ROW_NUMBER`), 답글 더보기 커서, FK
- `idx_comments_user_created (user_id, created_at)`: 속도 제한(1분 5개·하루 200개), 탈퇴 처리, FK
- `idx_comments_hidden_by (hidden_by)`: FK

## users — `0004`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| email | VARCHAR(255) | NOT NULL, UK | 콜레이션상 대소문자 무시 중복 검사. 서버는 소문자로 저장 권장 |
| password_hash | VARCHAR(255) | NOT NULL | argon2/bcrypt 문자열 |
| nickname | VARCHAR(30) | NOT NULL | 중복 허용 (기획 요구 없음) |
| role | ENUM('USER','ADMIN') | NOT NULL, 기본 USER | 관리자 API 권한 분리 |
| failed_login_count | TINYINT UNSIGNED | NOT NULL, 기본 0 | 5회 → `locked_until = now + 10분` |
| locked_until | DATETIME(3) | NULL | |
| onboarding_completed_at | DATETIME(3) | NULL | 온보딩 완료·건너뛰기 시각. NULL이면 온보딩 표시 |
| last_login_at | DATETIME(3) | NULL | |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

인덱스: `uk_users_email (email)`

## refresh_tokens — `0004`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| user_id | BIGINT UNSIGNED | FK → users CASCADE | |
| token_hash | BINARY(32) | NOT NULL, UK | 토큰 원문 미저장, SHA-256 |
| family_id | BINARY(16) | NOT NULL | 회전 토큰 재사용 감지 시 패밀리 일괄 폐기 |
| expires_at | DATETIME(3) | NOT NULL | |
| revoked_at | DATETIME(3) | NULL | 로그아웃·회전 시 |
| created_at | DATETIME(3) | NOT NULL | |

인덱스: `uk_refresh_tokens_token_hash`, `idx_refresh_tokens_user`, `idx_refresh_tokens_family`, `idx_refresh_tokens_expires` (만료 7일 후 삭제 배치)

## user_interest_tags — `0004`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| user_id | BIGINT UNSIGNED | PK, FK → users CASCADE | |
| tag_id | BIGINT UNSIGNED | PK, FK → tags CASCADE | 3~10개는 서버 검증 |
| created_at | DATETIME(3) | NOT NULL | |

인덱스: `idx_user_interest_tags_tag (tag_id)` — FK 인덱스, 태그 삭제 CASCADE

## bookmarks — `0005`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| user_id | BIGINT UNSIGNED | PK, FK → users CASCADE | |
| post_id | BIGINT UNSIGNED | PK, FK → posts CASCADE | |
| created_at | DATETIME(3) | NOT NULL | 저장한 순 정렬 |

인덱스
- PK: 토글, 피드 20건 `post_id IN (...)` 플래그 조회, 회원당 5,000건 COUNT
- `idx_bookmarks_user_created (user_id, created_at, post_id)`: 목록 커서
- `idx_bookmarks_post (post_id)`: FK 인덱스, 추천 인기도 보정 집계

## read_histories — `0005`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| user_id | BIGINT UNSIGNED | PK, FK → users CASCADE | |
| post_id | BIGINT UNSIGNED | PK, FK → posts CASCADE | |
| first_read_at | DATETIME(3) | NOT NULL | |
| last_read_at | DATETIME(3) | NOT NULL | 재클릭 시 갱신 (`ON DUPLICATE KEY UPDATE`) |

인덱스
- PK: 읽음 플래그 조회, 추천 후보에서 읽은 글 제외
- `idx_read_histories_user_last_read (user_id, last_read_at, post_id)`: 목록 커서, 추천 30일 선호도
- `idx_read_histories_last_read (last_read_at)`: 1년 삭제 배치
- `idx_read_histories_post (post_id)`: FK 인덱스

## post_view_guards — `0006`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| post_id | BIGINT UNSIGNED | PK | FK 없음 (고빈도 쓰기, 24시간 소멸) |
| viewer_key | BINARY(16) | PK | `SHA2('u:<id>' 또는 'v:<uuid>')` 앞 16바이트 |
| counted_at | DATETIME(3) | NOT NULL | 마지막으로 조회수에 반영한 시각 |

인덱스: `idx_post_view_guards_counted (counted_at)` — 매시간 삭제 배치

## recommendation_impressions — `0006` (골격, 세부는 M5 discussion)
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| request_id | BINARY(16) | NOT NULL | 추천 응답 1회 ID (UUID) |
| user_id | BIGINT UNSIGNED | NULL | FK 없음. 탈퇴 시 서버가 NULL 처리 (D-10) |
| post_id | BIGINT UNSIGNED | NOT NULL | FK 없음 |
| algorithm | VARCHAR(20) ascii | NOT NULL | `TAG_V1`, 이후 `TFIDF_V1` |
| position | SMALLINT UNSIGNED | NOT NULL | 노출 순서 |
| reason | VARCHAR(200) | NULL | 추천 이유 표시 문구 |
| shown_at | DATETIME(3) | NOT NULL | |
| clicked_at | DATETIME(3) | NULL | 클릭 시 갱신 |

인덱스
- `uk_rec_impressions_request_post (request_id, post_id)`: 클릭 갱신 대상 찾기
- `idx_rec_impressions_shown (shown_at, algorithm)`: 기간·알고리즘별 클릭률, 90일 삭제
- `idx_rec_impressions_user (user_id)`: 탈퇴 시 NULL 갱신

## recommendation_daily_stats — `0007`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| stat_date | DATE | PK | `shown_at` UTC 날짜 |
| algorithm | VARCHAR(20) ascii | PK | `TAG_V1` 등 |
| impression_count | INT UNSIGNED | NOT NULL, 기본 0 | 노출 수 |
| click_count | INT UNSIGNED | NOT NULL, 기본 0 | 클릭 수. 클릭률 = click / impression |
| request_count | INT UNSIGNED | NOT NULL, 기본 0 | 추천 응답 수 |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

- 영구 보관, 최근 7일 재집계 upsert (D-10a)
