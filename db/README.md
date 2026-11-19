# db

데브피드 MariaDB 스키마 (소유: `dba`). 설계 문서는 `docs/schema/`.

## 구조
```
db/
├── conf/devfeed.cnf     # MariaDB 서버 설정 (FULLTEXT 토큰 2자, stopword 끔, UTC)
├── migrations/          # 0001~0007, -- migrate:up / -- migrate:down
├── scripts/migrate.sh   # 컨테이너에 마이그레이션 적용
└── seeds/               # 개발용 시드 (예정)
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
