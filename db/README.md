# db

데브피드 MariaDB 스키마 (소유: `dba`). 설계 문서는 `docs/schema/`.

## 구조
```
db/
├── conf/devfeed.cnf     # MariaDB 서버 설정 (FULLTEXT 토큰 2자, stopword 끔, UTC)
├── perf/                # 성능 측정용 대량 시드 생성기, 측정 스크립트
├── queries/            # feed.sql(007·021 분야·보안 뉴스·kind 정합성 검사), reactions.sql(026 좋아요·댓글·탈퇴·정합성 검사), passkeys.sql(027 패스키·챌린지), score.sql(029 점수 적립·회수·백필·정합성 검사), community.sql(032 커뮤니티 글·신고·채택·점수·정합성 검사), personal.sql·withdrawal-check.sql(012), recommendation.sql(013) 기준 쿼리
├── ops/                 # launchd 일일 백업 템플릿·설치 스크립트
├── migrations/          # 0001~0015, -- migrate:up / -- migrate:down
├── scripts/migrate.sh   # 컨테이너에 마이그레이션 적용
├── scripts/seed.sh      # seeds/*.sql 순서대로 적용 (재실행 안전)
├── scripts/perf-seed.sh # 측정 DB(devfeed_perf)에 글 10만·회원 1만 생성
├── scripts/test-db-reset.sh # e2e DB(devfeed_test) 재생성 + 전체 마이그레이션
├── scripts/backup.sh    # devfeed 덤프 → ~/backups/devfeed, 14일 보관
├── scripts/restore.sh   # 백업을 지정 DB로 복원 (devfeed는 --force 필요)
├── scripts/tag-rename-impact.py # 태그 이름 변경안(JSON)의 자동 태깅 영향 시뮬레이션 (서버 tagger 규칙 포팅)
├── data/                # 023-tag-renames.json 태그 영어화 변경안 (023)
└── seeds/               # 001 소스 36곳, 002 태그 153개(023 영어 표기)·동의어 279개, 003 보안 뉴스 6곳
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
- `002_tags.sql`: 태그 153개(분류 16개, 기술 분류·용어는 영어 표기, 023), 동의어 279개. 영어로 바꾼 태그 47개는 옛 한글 이름을 동의어로 보존. 동의어는 태그 간·태그명과 겹치지 않음
  - 오탐 우려로 뺀 짧은 동의어: `CD`, `ES`, `RN`, `PG`, `DW`, `Cursor`, `람다`, `Compose`
- `003_security_news_sources.sql`: 보안 뉴스 국내 3곳(데일리시큐, KISA 보안공지, AhnLab ASEC) + 해외 3곳(The Hacker News, BleepingComputer, SecurityWeek). 주기 30분, KISA 60분 (021)
  - 운영 `devfeed` 적용 (2026-11-20, server 배포 후): 첫 수집 6곳 성공, 165건
- 모두 `ON DUPLICATE KEY UPDATE`라 여러 번 실행해도 결과 같음

## 백업·복원
```bash
export DB_USER=<계정> MYSQL_PWD=<비밀번호>
db/scripts/backup.sh                                        # ~/backups/devfeed/devfeed_<UTC>.sql.gz
db/scripts/restore.sh ~/backups/devfeed/<파일> devfeed_restore_check   # 임시 DB로 복원
db/scripts/restore.sh ~/backups/devfeed/<파일> devfeed --force          # 운영 DB 덮어쓰기
```
- 일일 자동 백업 (04:30 KST): `~/.config/devfeed/backup.env`에 `DB_USER`, `MYSQL_PWD` 작성 후 `chmod 600` → `db/ops/install-backup-agent.sh`
- 로그 `~/backups/devfeed/backup.log`, 14일 지난 백업 자동 삭제. 복원 검증 결과는 discussion 014

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
MYSQL_PWD=<비밀번호> python3 -I db/perf/measure_recommendation.py # 추천 선호도·후보 쿼리 p50/p95
MYSQL_PWD=<비밀번호> python3 -I db/perf/measure_field.py  # 분야·기업/개인·보안 뉴스 쿼리 p50/p95 (021)
MYSQL_PWD=<비밀번호> python3 -I db/perf/measure_reactions.py # 좋아요·댓글 쿼리 p50/p95 (026)
MYSQL_PWD=<비밀번호> python3 -I db/perf/measure_score.py # 프로필·등급·하루 한도 쿼리 p50/p95 (029)
MYSQL_PWD=<비밀번호> python3 -I db/perf/measure_community.py # 커뮤니티 목록·인기·작성 제한 쿼리 p50/p95 (032)
```
- DB `devfeed_perf`는 미리 생성 (`utf8mb4_unicode_ci`). 개발 DB `devfeed`와 분리해 합성 글이 섞이지 않게 함
- 글 10만, post_tags 약 20만, 회원 1만, 북마크 약 50만, 읽은 기록 약 190만. 디스크 약 800MB
- 글 텍스트는 `devfeed` 실제 글 단어를 재조합. 토큰은 서버 `tokenizer.ts`와 같은 규칙 (`perf/generate_posts.py`)
- 좋아요 50만·댓글 10만·답글 5만 합성: `perf/reactions.sql` (약 4분)
- 커뮤니티 글 2만 합성(1년 분포, 2% 숨김): `perf/community.sql` (`0015` 후)
- 보안 뉴스 합성 4만 건(2년 분포, `보안` 태그 + 원본 1순위 태그): `003` 시드 후 `perf/news.sql` 실행
- 고정 시드라 재생성해도 같은 분포. 측정 결과는 discussion 007 (피드), 010 (검색), 013 (추천), 021 (분야·보안 뉴스, `decisions.md` D-19)

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

## 검증 기록 (2026-11-20, `0010`, 021)
- `devfeed_perf`(10만 건)·`devfeed_test`에서 up → down → up 통과. 10만 건 적용 1초 (컬럼 INSTANT, 인덱스 INPLACE)
- `ck_sources_kind_region`: 뉴스인데 region 없음 / 블로그인데 region 있음 모두 거부
- `003` 시드 2회 실행 후 뉴스 6곳 유지 (국내 3·해외 3, 주기 30·60분)
- `feed.sql` 전체 실행 오류 없음, kind 정합성 검사 4항목 0
- `devfeed` 적용 (2026-11-20, 사용자 승인): 소스 36·글 2,387·태그 연결 2,826·검색 2,387 전후 동일, 전부 BLOG. kind 검사 4항목 0, 서버 `/api/health`·`/api/posts`·`/api/posts/popular` 200

## 검증 기록 (2026-11-21, `0011`, 023)
- `devfeed_perf` up → down → up, down 후 태그·동의어 내용 해시 원본 일치. 갱신 시드 재실행 결과와 up 결과 일치
- 태깅 영향 (`scripts/tag-rename-impact.py`, 운영 글 2,588건): 손실 0, 추가 6건(정답), 순서 변경 2건
- `devfeed` 적용: 적용 전후 해시가 perf 검증과 동일, 동의어 266 → 279, `post_tags` 변화 없음

## 검증 기록 (2026-11-21, `0012`, 026)
- `devfeed_test`·`devfeed_perf` up → down → up 통과
- CHECK 거부: 빈 본문, `HIDDEN`인데 `hidden_at` 없음 / 1,001자 거부(1406) / 처리 안 한 회원 삭제 FK 거부(1451)
- 좋아요 동시 20개 요청 2회: 행·카운터 일치. 탈퇴 처리 후 잔존 0·정합성 0
- `devfeed` 적용 (2026-11-21, 사용자 승인): 글 2,607·회원 3·`post_tags` 3,075 전후 동일, 카운터 0, 정합성 6항목 0, 서버 공개 API 200

## 검증 기록 (2026-11-22, `0013`, 027)
- `devfeed_test`·`devfeed_perf` up → down → up 통과
- 챌린지: 첫 소비 1, 재사용 0, 만료 0. REGISTER인데 회원 없음 CHECK 거부
- 패스키: credential 중복 1062, 이름 공백 CHECK·41자 1406, credential 8바이트 CHECK 거부. 서명 횟수 역행 영향 0·증가 1. credential 조회 `const`
- `devfeed` 적용 (2026-11-22, 사용자 승인): 회원 3·리프레시 토큰 71·글 2,610·댓글 1·좋아요 2 전후 동일, 새 테이블 2개 생성, 서버 health·피드 200, 잘못된 로그인 401(기존 동작)

## 검증 기록 (2026-11-22, `0014`, 029)
- `devfeed_test`·`devfeed_perf` up → down → up 통과
- 시나리오 (롤백): 읽기 31회+중복 1회 → 30점·30행 / 좋아요 2번 +2, 취소 −2 / 댓글 11개 50점, 삭제 −5·중복 삭제 0·복구 +5, 0점 댓글 회수 0, 회수 후 12번째 0점
- 백필 255만 행 22초, 정합성 6항목 0. READ 1년 접기 21만 행 2.6초·점수 불변·재실행 변화 0 (롤백)
- `devfeed` 적용 (2026-11-22, 사용자 승인): 회원 3·읽은 기록 12·좋아요 3·댓글 2 전후 동일, `score` 전부 0, 서버 200. 백필 완료(원장 17행·점수 합 28, 정합성 0)

## 검증 기록 (2026-11-22, `0015`, 032)
- `devfeed_test`·`devfeed_perf` up → down → up 통과 (perf 14초)
- CHECK 거부: 본문 10자 미만, 숨김인데 시각·사유 없음, `OTHER` 아닌 사유에 detail, LIKE_RECEIVED인데 actor 0, 커뮤니티 소스에 region. 대상 행 없는 신고 FK 거부
- 시나리오 (롤백): 글 4개 → POST_WRITE 30점(4번째 0점), 서로 다른 2명 신고 → 숨김 아님, 3명 → 자동 숨김(`REPORTS`)·POST_WRITE 회수·중복 신고 0, 받은 좋아요 켜기 2번 1행·끄기 0행
- `devfeed` 적용 (2026-11-22 11:42 UTC, 사용자 승인, server에 사전·완료 알림): 소스 42 → 43(내부 소스 id 81), 글 2,622·태그 3,089·댓글 2·원장 17·점수 합 28 동일. 정합성 026·029·032 전부 0, 공개 API 200, `/sources`에 내부 소스 노출 없음
