# db

데브피드 MariaDB 스키마 (소유: `dba`). 설계 문서는 `docs/schema/`.

## 구조
```
db/
├── conf/devfeed.cnf     # MariaDB 서버 설정 (FULLTEXT 토큰 2자, stopword 끔, UTC)
├── perf/                # 성능 측정용 대량 시드 생성기, 측정 스크립트
├── queries/            # feed.sql(007), personal.sql·withdrawal-check.sql(012) 기준 쿼리
├── migrations/          # 0001~0009, -- migrate:up / -- migrate:down
├── scripts/migrate.sh   # 컨테이너에 마이그레이션 적용
├── scripts/seed.sh      # seeds/*.sql 순서대로 적용 (재실행 안전)
├── scripts/perf-seed.sh # 측정 DB(devfeed_perf)에 글 10만·회원 1만 생성
├── scripts/test-db-reset.sh # e2e DB(devfeed_test) 재생성 + 전체 마이그레이션
└── seeds/               # 001 소스 36곳, 002 태그 153개·동의어 266개
```

## 서버 설정
- `devfeed.cnf`를 컨테이너 `/etc/mysql/conf.d/`에 두고 재시작해야 함
- `innodb_ft_min_token_size`는 재시작 후에만 반영. 반영 전 만든 FULLTEXT 인덱스는 재생성 필요

## 마이그레이션 적용
```bash
export DB_USER=<계정> MYSQL_PWD=<비밀번호>
db/scripts/migrate.sh up   db/migrations/*.sql
db/scripts/migrate.sh down db/migrations/*.sql
```
- `down`은 파일 순서를 뒤집어 적용함
- DB `devfeed`는 미리 생성돼 있어야 함 (`utf8mb4` / `utf8mb4_unicode_ci`)

## 시드
```bash
export DB_USER=<계정> MYSQL_PWD=<비밀번호>
db/scripts/seed.sh
```
- `001_sources.sql`: 기업 33곳 + 개인 3곳. 2026-11-19에 피드 응답(200, RSS/Atom, 글 1건 이상) 확인한 곳만 포함
  - 제외: 네이버 D2·쏘카(404), 컬리·리디(403), 카카오페이·넷마블·삼성SDS(글 0건 또는 피드 아님), 마켓보로·카카오엔터 FE(404)
  - 1년 이상 새 글 없는 피드(직방, 쿠팡, 야놀자, 번개장터, 클래스101, 테코블 등)도 과거 글 아카이브용으로 포함
- `002_tags.sql`: 태그 153개(분류 16개), 동의어 266개. 동의어는 태그 간·태그명과 겹치지 않음
  - 오탐 우려로 뺀 짧은 동의어: `CD`, `ES`, `RN`, `PG`, `DW`, `Cursor`, `람다`, `Compose`
- 모두 `ON DUPLICATE KEY UPDATE`라 여러 번 실행해도 결과 같음

## DB 구성
| DB | 용도 | 데이터 |
|---|---|---|
| `devfeed` | 개발 (server :3000) | 실제 수집 글, 시드 소스·태그 |
| `devfeed_perf` | 성능 측정 (M2·M3) | 합성 글 10만·회원 1만 |
| `devfeed_test` | server e2e | 비어 있음, 테스트가 만들고 지움. `test-db-reset.sh`로 초기화 |

## 성능 측정 DB
```bash
export DB_USER=<계정> MYSQL_PWD=<비밀번호>
db/scripts/perf-seed.sh                    # devfeed_perf 비어 있어야 함, 약 30초
MYSQL_PWD=<비밀번호> python3 -I db/perf/measure_feed.py   # 피드 쿼리 p50/p95
MYSQL_PWD=<비밀번호> python3 -I db/perf/measure_search.py # 검색 쿼리 p50/p95 (현행·권장·LIKE 기준선)
```
- DB `devfeed_perf`는 미리 생성 (`utf8mb4_unicode_ci`). 개발 DB `devfeed`와 분리해 합성 글이 섞이지 않게 함
- 글 10만, post_tags 약 20만, 회원 1만, 북마크 약 50만, 읽은 기록 약 190만. 디스크 약 800MB
- 글 텍스트는 `devfeed` 실제 글 단어를 재조합. 토큰은 서버 `tokenizer.ts`와 같은 규칙 (`perf/generate_posts.py`)
- 고정 시드라 재생성해도 같은 분포. 측정 결과는 discussion 007 (피드), 010 (검색)

## 검증 기록 (2026-11-19, MariaDB 12.1.2)
- 설정 반영 확인: `innodb_ft_min_token_size=2`, `innodb_ft_enable_stopword=OFF`, `time_zone=+00:00`
- 0001~0007 up → down → up 통과 (테이블 15개)
- 동작 확인
  - `feed_url_hash`·`url_hash` 생성 컬럼 UNIQUE로 중복 거부, `ON DUPLICATE KEY UPDATE` 시 1건 유지
  - `crawl_interval_min < 30` CHECK 거부, `next_crawl_at` 기본값 채워짐
  - 한글 bigram 검색 `+리밸 +밸런 +런싱`, 영문 2자 토큰 `k8s` 검색 성공
  - `post_view_guards` upsert affected rows: 최초 1, 24시간 내 재조회 0
  - 수집 선점 UPDATE: 1차 1, 2차 0
  - 피드·태그 커서 쿼리 EXPLAIN: `idx_posts_published`, `idx_post_tags_tag_published` range + Using index (filesort 없음)
- 설정 파일은 `docker cp`로 넣었음. 컨테이너를 다시 만들면 사라지므로 `-v <repo>/db/conf:/etc/mysql/conf.d:ro` 마운트 필요
