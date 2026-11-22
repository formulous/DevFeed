# 테이블 명세

- 작성: dba
- 상태: v1.5 (M12, 2026-11-22). 마이그레이션 0001~0015 기준. `0015`는 `devfeed_perf`·`devfeed_test` 적용, `devfeed`는 사용자 확인 후
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
| kind | ENUM('BLOG','SECURITY_NEWS','COMMUNITY') | NOT NULL, 기본 BLOG | `0010`. 등록 후 변경 불가 (서버 보장). 기존 36곳 BLOG (D-18). `COMMUNITY`는 `0015`의 내부 소스 1행(`internal:community`, INACTIVE)만 (D-25) |
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
| kind | ENUM('BLOG','SECURITY_NEWS','COMMUNITY') | NOT NULL, 기본 BLOG | `0010`. `sources.kind` 비정규화. 블로그·보안 뉴스·커뮤니티 목록 분리 (D-18, D-25) |
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
| kind | ENUM('BLOG','SECURITY_NEWS','COMMUNITY') | NOT NULL, 기본 BLOG | `0010`. `posts.kind` 비정규화. 태그·분야 필터에서 다른 종류 건너뛰기 방지 (D-18) |

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
| hidden_reason | ENUM('ADMIN','REPORTS') | NULL | `0015`. `HIDDEN`일 때 필수. 신고 3건 자동 숨김은 `REPORTS`, `hidden_by` NULL (D-25) |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

제약
- `ck_comments_status_body`: `DELETED` ↔ `body`·`user_id` NULL, 그 외는 둘 다 필수·1자 이상
- `ck_comments_hidden`: `status = 'HIDDEN'` ↔ `hidden_at`·`hidden_reason` 있음 (`0015`)

인덱스
- `idx_comments_post_parent (post_id, parent_id, id)`: 글의 댓글 오래된 순 커서 (`parent_id IS NULL AND id > ?`)
- `idx_comments_parent (parent_id, id)`: 답글 처음 3개(부모 20개 한 번에 `ROW_NUMBER`), 답글 더보기 커서, FK
- `idx_comments_user_created (user_id, created_at)`: 속도 제한(1분 5개·하루 200개), 탈퇴 처리, FK
- `idx_comments_hidden_by (hidden_by)`: FK

## community_posts — `0015` (`posts` 1:1 확장)
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| post_id | BIGINT UNSIGNED | PK, FK → posts CASCADE | `posts.kind = 'COMMUNITY'` 행. 좋아요·댓글·북마크·읽은 기록·원장·태그를 `posts.id`로 그대로 재사용 |
| user_id | BIGINT UNSIGNED | NULL, FK → users (RESTRICT) | 작성자. `DELETED`면 NULL |
| category | ENUM('QUESTION','DISCUSSION','SHARE') | NOT NULL | 말머리 |
| body | MEDIUMTEXT | NULL, CHECK 10~20,000자 | 원문 마크다운 (utf8mb4 최대 80KB라 TEXT 초과). `DELETED`면 NULL |
| status | ENUM('VISIBLE','HIDDEN','DELETED') | NOT NULL | 목록은 `VISIBLE`만. 삭제는 항상 이 값으로 (행 삭제 안 함, D-25) |
| accepted_comment_id | BIGINT UNSIGNED | NULL, FK → comments SET NULL | 채택 댓글. 질문글·같은 글·최상위·다른 회원 조건은 server + 정합성 검사 |
| published_at | DATETIME(3) | NOT NULL | `posts.published_at` 복사(불변). 목록 커서 인덱스용 |
| edited_at | DATETIME(3) | NULL | "수정됨" |
| hidden_at / hidden_by / hidden_reason | | NULL | 댓글과 같은 숨김 규칙 (`ADMIN`·`REPORTS`) |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

- `posts` 쪽: `source_id` = 내부 소스, `source_type` `PERSONAL`(쓰지 않음), `url` = 정식 주소(`{base}/community/posts/{id}`, 삽입 후 같은 트랜잭션에서 갱신), `title` 2~100자, `summary` = 마크다운을 걷어낸 앞부분(목록 excerpt), `thumbnail_url` NULL, `post_search` 행 없음(검색 제외)

인덱스
- `idx_community_posts_status_published (status, published_at, post_id)`: 최신 커서, 인기 기간 범위
- `idx_community_posts_status_category_published (status, category, published_at, post_id)`: 말머리 필터 커서
- `idx_community_posts_user_created (user_id, created_at)`: 프로필 글 수, FK
- `idx_community_posts_accepted`, `idx_community_posts_hidden_by`: FK

## report_targets — `0015`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| target_type / target_id | ENUM('POST','COMMENT') / BIGINT UNSIGNED | PK | 대상 (FK 없음: 다형 대상) |
| report_count | INT UNSIGNED | NOT NULL | 서로 다른 신고자 수 = `reports` 행 수 |
| state | ENUM('PENDING','HIDDEN','CLEARED') | NOT NULL | 3건이면 `PENDING` → `HIDDEN`(자동 숨김). `CLEARED`(문제없음)면 이후 자동 숨김 제외 |
| first_reported_at / last_reported_at | DATETIME(3) | NOT NULL | A-05 정렬 |
| resolved_at / resolved_by | | NULL, `resolved_by` FK → users SET NULL | 관리자 처리 |

인덱스: `idx_report_targets_state_last (state, last_reported_at)` (A-05 대기 목록)

## reports — `0015`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| target_type / target_id | | FK → report_targets CASCADE | 대상 행을 먼저 upsert 후 삽입 |
| reporter_id | BIGINT UNSIGNED | NULL, FK → users SET NULL | 탈퇴 시 NULL (신고 사실·개수는 유지, 신고자만 지움) |
| reason | ENUM('SPAM','ABUSE','PRIVACY','OTHER') | NOT NULL | |
| detail | VARCHAR(200) | NULL, CHECK `OTHER`만 | |
| created_at | DATETIME(3) | NOT NULL | |

인덱스: `uk_reports_target_reporter (target_type, target_id, reporter_id)` (1인 1회, `INSERT IGNORE` 영향 행), `idx_reports_reporter` (FK)

## users — `0004`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | |
| email | VARCHAR(255) | NOT NULL, UK | 콜레이션상 대소문자 무시 중복 검사. 서버는 소문자로 저장 권장 |
| password_hash | VARCHAR(255) | NOT NULL | argon2/bcrypt 문자열 |
| nickname | VARCHAR(30) | NOT NULL | 중복 허용 (기획 요구 없음) |
| webauthn_handle | BINARY(32) | NULL, UK | `0013`. WebAuthn user handle. 첫 패스키 등록 옵션 발급 때 랜덤 32바이트로 채움, 바뀌지 않음 (D-23) |
| score | INT UNSIGNED | NOT NULL, 기본 0 | `0014`. 활동 점수 캐시 = `score_events` 미회수 `points` 합. 원장 변경과 같은 트랜잭션에서 증감. 등급은 server 상수로 계산 (D-24) |
| role | ENUM('USER','ADMIN') | NOT NULL, 기본 USER | 관리자 API 권한 분리 |
| failed_login_count | TINYINT UNSIGNED | NOT NULL, 기본 0 | 5회 → `locked_until = now + 10분` |
| locked_until | DATETIME(3) | NULL | |
| onboarding_completed_at | DATETIME(3) | NULL | 온보딩 완료·건너뛰기 시각. NULL이면 온보딩 표시 |
| last_login_at | DATETIME(3) | NULL | |
| created_at / updated_at | DATETIME(3) | NOT NULL | |

인덱스: `uk_users_email (email)`

## user_passkeys — `0013`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK | API `passkeyId` |
| user_id | BIGINT UNSIGNED | FK → users CASCADE | 탈퇴 시 자동 삭제 (카운터 없음) |
| credential_id | VARBINARY(1023) | NOT NULL, UK, CHECK 16바이트 이상 | 표준 최대 1023바이트. 로그인 시 이 값으로 조회 (const) |
| public_key | VARBINARY(2048) | NOT NULL | COSE 공개키 원본 (RSA 포함 여유) |
| sign_count | INT UNSIGNED | NOT NULL, 기본 0 | 역행 거부. 0을 계속 쓰는 인증기는 허용 |
| transports | VARCHAR(255) | NULL | 쉼표 구분 (`internal,hybrid`). 다음 옵션의 힌트 |
| aaguid | BINARY(16) | NULL | 인증기 모델. 이름 자동 생성·통계용 (attestation `none`이면 0일 수 있음) |
| backup_eligible / backup_state | BOOLEAN | NOT NULL, 기본 FALSE | 동기화 패스키 여부(BE·BS 플래그). `backup_state`는 로그인 때 갱신 |
| name | VARCHAR(40) | NOT NULL, CHECK 공백 제외 1자 이상 | |
| created_at / last_used_at / updated_at | DATETIME(3) | `last_used_at` NULL | |

인덱스
- `uk_user_passkeys_credential (credential_id)`: 로그인 조회, 중복 등록 거부(→ `PASSKEY_ALREADY_REGISTERED`)
- `idx_user_passkeys_user_created (user_id, created_at)`: 목록, 10개 제한 개수 확인, FK

## webauthn_challenges — `0013`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| challenge_hash | BINARY(32) | PK | 챌린지 SHA-256. 원문 저장 안 함 |
| purpose | ENUM('REGISTER','LOGIN') | NOT NULL | |
| user_id | BIGINT UNSIGNED | NULL, FK → users CASCADE | REGISTER만 필수 (CHECK) |
| expires_at | DATETIME(3) | NOT NULL | 발급 + 5분 |
| created_at | DATETIME(3) | NOT NULL | |

인덱스
- PK: 1회 소비 `DELETE ... WHERE challenge_hash = ? AND purpose = ? AND expires_at > now` 영향 행 1일 때만 통과
- `idx_webauthn_challenges_expires`: 발급 때 만료 행 100개씩 정리
- `idx_webauthn_challenges_user`: FK

## score_events — `0014`
| 컬럼 | 타입 | 제약 | 설명·이유 |
|---|---|---|---|
| user_id | BIGINT UNSIGNED | PK, FK → users CASCADE | 탈퇴 시 원장 삭제 |
| kind | ENUM('READ','LIKE','COMMENT','ARCHIVE','POST_WRITE','LIKE_RECEIVED') | PK | `ARCHIVE`는 1년 지난 READ를 회원당 1행으로 접은 합계 (D-24) |
| ref_id | BIGINT UNSIGNED | PK | READ·LIKE·POST_WRITE·LIKE_RECEIVED = post_id, COMMENT = comment_id, ARCHIVE = 0 |
| actor_id | BIGINT UNSIGNED | PK, 기본 0 | `0015`. LIKE_RECEIVED만 좋아요 누른 회원 id, 나머지 0 (CHECK) |
| points | INT UNSIGNED | NOT NULL | 실제 적립 점수. 하루 한도 넘은 댓글은 0 |
| created_at | DATETIME(3) | NOT NULL | 하루 한도 계산 기준 (KST 자정 범위를 UTC로 변환해 비교) |
| revoked_at | DATETIME(3) | NULL, CHECK COMMENT·POST_WRITE만 | 댓글 삭제·숨김 회수. 숨김 해제 시 NULL |

인덱스
- PK `(user_id, kind, ref_id, actor_id)` (`0015`에서 `actor_id` 추가): 같은 글 재읽기·중복 좋아요 차단(`INSERT IGNORE` 영향 행), 회수 대상 조회. 별도 id 없음 (행 크기 절약)
- `idx_score_events_user_kind_created (user_id, kind, created_at)`: 하루 한도(읽기 30·댓글 10) 계산

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
