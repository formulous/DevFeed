# 007. M2 피드 커서·필터 쿼리 EXPLAIN 검토

- 상태: decided
- 제기: dba
- 관련: server, pm
- 관련 문서: `db/queries/feed.sql`, `docs/schema/decisions.md` D-07, `docs/api/openapi.yaml` `/posts`, `/posts/popular`

## 배경
- pm 요청: M2 피드(F-010~F-013) 커서·필터 쿼리 EXPLAIN 검토 지원
- 서버 피드 모듈 구현 전이라 dba가 기준 쿼리를 `db/queries/feed.sql`에 작성하고, 로컬 `devfeed`(글 2,383건, post_tags 약 2,800건)에서 `ANALYZE`로 실제 읽은 행 수(`r_rows`)를 측정함
- 커서 조건은 `published_at < ? OR (published_at = ? AND id < ?)` 형태. MariaDB 12.1에서 range 스캔으로 잘 동작함 (행 생성자 비교 불필요)
- 한 페이지 20건 + 다음 페이지 존재 확인용 1건 = `LIMIT 21`

## 측정 결과

| 쿼리 | 사용 인덱스 | 실제 읽은 행 | 판정 |
|---|---|---|---|
| 최신 피드 (첫 페이지·다음 페이지) | `idx_posts_published` | 21 | 좋음 |
| `sourceType` | `idx_posts_type_published` | 21 | 좋음 |
| `sourceIds` 1개 | `idx_posts_source_published` | 21 | 좋음 |
| `sourceIds` 여러 개, `IN` | `idx_posts_published` 전체 순회 + 필터 | 34 (데이터 분포에 따라 최대 전체) | **위험** |
| `sourceIds` 여러 개, 소스별 `UNION ALL` | `idx_posts_source_published` × N | 최대 21 × N | 좋음 |
| `tagIds` 1개 | `idx_post_tags_tag_published` | 21 | 좋음 |
| `tagIds` 여러 개, `IN` + `GROUP BY` | 같은 인덱스, 해당 태그 전체 | 480 + 임시 테이블 + filesort | **위험** (태그 글 수에 비례) |
| `tagIds` 여러 개, 태그별 `UNION` | 같은 인덱스 × N | 최대 21 × N | 좋음 |
| `tagIds` + `sourceType` | 태그 인덱스로 순회 후 `posts` PK 조인 필터 | 112 | 허용 (아래 참고) |
| 인기 글 MONTH | `idx_posts_published` 범위 + filesort | 최근 30일 글 수 | 허용 (10분 캐시) |
| 카드 태그 조회, 북마크·읽음 플래그 | PK | 페이지당 수십 | 좋음 |

## 제안 (server 구현 기준)
1. **`sourceIds` 2개 이상은 소스별 서브쿼리 `UNION ALL`** 후 바깥에서 정렬·`LIMIT 21`
   - `IN`은 옵티마이저가 `idx_posts_published`를 순회하며 거르는 계획을 고름. 고른 소스가 글이 적으면 사실상 전체 글을 훑음
   - 소스는 서로 겹치지 않으므로 `UNION ALL` (중복 제거 불필요)
2. **`tagIds` 2개 이상은 태그별 서브쿼리 `UNION`** (`UNION ALL` 아님)
   - 한 글이 여러 태그에 걸리면 `(post_id, published_at)`가 같은 행이 나오므로 `UNION`으로 중복 제거
   - 각 서브쿼리가 21건씩 가져오므로 합친 뒤에도 21건 이상이 보장됨
3. **태그 + 소스/유형 조합**: 태그 인덱스가 순서를 정하고 `posts` PK 조인으로 거름
   - 조건이 좁을수록(드문 소스) 많이 훑음. 최악은 해당 태그 글 전체 (10만 건 기준 인기 태그 수천 건)
   - 태그가 여러 개면 2번의 각 서브쿼리 안에 조인·필터를 넣음
4. 인기 글: 30일 범위 filesort. 10분 캐시 전제에서 문제없음
5. 서브쿼리 안 `ORDER BY ... LIMIT`은 괄호로 감싸야 적용됨 (`feed.sql` 형식 참고)

## 한계
- 글 2,383건 기준 측정이라 옵티마이저 선택이 10만 건에서 달라질 수 있음
- M3 대량 시드(글 10만 건)로 같은 쿼리를 다시 측정해 p95와 함께 이 문서와 D-07에 남길 예정

## 의견

### dba (1차)
- 위 1·2번은 응답 시간 목표(p95 300ms)에 직결되므로 구현 시 반영 요청함. 서버 쿼리가 나오면 같은 방식으로 `ANALYZE` 확인해 줄 수 있음

### pm (1차)
- 기획 범위 영향 없음. 필터 상한(태그 10·소스 20, 004 결정) 안에서 `UNION` 분해 시 최대 서브쿼리 수가 제한되므로 1·2번 방식에 동의함
- 3번(태그 + 소스/유형 조합)은 기능 제한 없이 유지함. M3 대량 시드 측정에서 p95 300ms를 넘으면 그때 대안(조합 상한, 비정규화 인덱스 등)을 새 discussion으로 다룸
- 쿼리 형태 최종 결정은 server 의견 후 기록함

### server (1차)
- 1·2·3·5 그대로 수용해 구현 중
  - `sourceIds` 2개 이상: 소스별 서브쿼리 `UNION ALL`, 1개면 단일 쿼리
  - `tagIds` 2개 이상: 태그별 서브쿼리 `UNION`. 태그+소스/유형은 각 서브쿼리 안에서 `posts` PK 조인으로 거름
  - 태그와 소스를 함께 고르면 태그 쪽으로 분해함 (태그 × 소스 조합 수만큼 쪼개지 않음. 최대 서브쿼리 10개 유지)
- 4: 인기 글은 기간별 10분 메모리 캐시. `viewCount`는 캐시 시점 값으로 응답함 (순서와 수치를 일치시키기 위함)
- 구현 후 실제 서버 쿼리를 이 문서에 붙이고 dba에게 `ANALYZE` 재확인 요청 예정

### server (2차) — 구현 쿼리 첨부, ANALYZE 요청
- 생성 위치: `server/src/posts/feed-query.ts` (`buildFeedQuery`), 단위 테스트 `feed-query.spec.ts`
- 아래는 실제 생성 SQL과 바인딩 값 예시 (커서 = 2026-11-10, id 500)

```sql
-- 최신 피드 다음 페이지
SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE (p.published_at < ? OR (p.published_at = ? AND p.id < ?)) ORDER BY p.published_at DESC, p.id DESC LIMIT ?;
-- params: ["2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,21]

-- sourceType
SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE p.source_type = ? AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?)) ORDER BY p.published_at DESC, p.id DESC LIMIT ?;
-- params: ["PERSONAL","2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,21]

-- sourceIds 여러 개
SELECT id, published_at FROM ((SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE p.source_id = ? AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?)) ORDER BY p.published_at DESC, p.id DESC LIMIT ?) UNION ALL (SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE p.source_id = ? AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?)) ORDER BY p.published_at DESC, p.id DESC LIMIT ?) UNION ALL (SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE p.source_id = ? AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?)) ORDER BY p.published_at DESC, p.id DESC LIMIT ?)) f ORDER BY published_at DESC, id DESC LIMIT ?;
-- params: [1,"2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,21,2,"2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,21,3,"2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,21,21]

-- tagIds 1개
SELECT pt.post_id AS id, pt.published_at AS published_at FROM post_tags pt WHERE pt.tag_id = ? AND (pt.published_at < ? OR (pt.published_at = ? AND pt.post_id < ?)) ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT ?;
-- params: [1,"2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,21]

-- tagIds 여러 개 + sourceType
SELECT id, published_at FROM ((SELECT pt.post_id AS id, pt.published_at AS published_at FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.tag_id = ? AND (pt.published_at < ? OR (pt.published_at = ? AND pt.post_id < ?)) AND p.source_type = ? ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT ?) UNION (SELECT pt.post_id AS id, pt.published_at AS published_at FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.tag_id = ? AND (pt.published_at < ? OR (pt.published_at = ? AND pt.post_id < ?)) AND p.source_type = ? ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT ?) UNION (SELECT pt.post_id AS id, pt.published_at AS published_at FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.tag_id = ? AND (pt.published_at < ? OR (pt.published_at = ? AND pt.post_id < ?)) AND p.source_type = ? ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT ?)) f ORDER BY published_at DESC, id DESC LIMIT ?;
-- params: [1,"2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,"COMPANY",21,3,"2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,"COMPANY",21,119,"2026-11-10T00:00:00.000Z","2026-11-10T00:00:00.000Z",500,"COMPANY",21,21]
```

- 카드 조회: `posts JOIN sources WHERE p.id IN (...)`, `post_tags JOIN tags WHERE post_id IN (...) ORDER BY post_id, tag_rank`, 회원이면 `bookmarks`·`read_histories`를 `user_id = ? AND post_id IN (...)`로 각 1회
- 인기 글: `SELECT id FROM posts WHERE published_at >= ? ORDER BY view_count DESC, published_at DESC, id DESC LIMIT 20` (기간별 10분 캐시)
- 서버 쪽 확인 결과 (글 2,383건)
  - 필터 8가지 조합(없음, 유형, 소스 1·3개, 태그 1·3개, 태그3+유형, 태그2+소스3)을 끝까지 스크롤한 결과가 기준 SQL과 순서까지 일치, 중복·누락 0
  - 스크롤 도중 새 글을 넣어도 중복·누락 0
  - API 응답 p50 1.1ms, p95 2.5ms (293요청)
- dba에게 위 쿼리 `ANALYZE` 재확인 요청함

### dba (2차) — 서버 실제 쿼리 10만 건 측정
- 환경: 측정 전용 DB `devfeed_perf` (사용자 승인), MariaDB 12.1.2, 로컬 Docker
  - 글 100,000 / post_tags 205,383 / 회원 10,000 / 북마크 498,409 / 읽은 기록 1,911,925 (`db/scripts/perf-seed.sh`)
  - 글 제목·요약은 실제 수집 글 단어를 재조합하고, 토큰은 `server/src/ingest/tokenizer.ts`와 같은 규칙(실제 글 300건 비교 불일치 0)
  - 분포: 태그·소스는 멱법칙(인기 태그 28 = 25,752건, 희소 태그 84 = 297건), 개인 블로그 5%
- 방법: `server (2차)`의 생성 SQL을 그대로 쓰고 값만 바꿔 `ANALYZE FORMAT=JSON` 20회 (앞 2회 워밍업 제외). 시간은 DB 실행 시간(`r_total_time_ms`)이고 네트워크·ORM 미포함 (`db/perf/measure_feed.py`)

| 쿼리 | p50 ms | p95 ms | 읽은 행 | 인덱스 | 비고 |
|---|---|---|---|---|---|
| 최신 피드 다음 페이지 | 0.01 | 0.02 | 21 | idx_posts_published |  |
| 최신 피드, 1년 전 커서 | 0.01 | 0.01 | 21 | idx_posts_published |  |
| sourceType PERSONAL (5%) | 0.01 | 0.01 | 21 | idx_posts_type_published |  |
| sourceIds 3개 큰 소스 (12,8,21) | 0.03 | 0.04 | 126 | idx_posts_source_published | filesort |
| sourceIds 2개 작은 소스 (19,7) | 0.02 | 0.02 | 84 | idx_posts_source_published | filesort |
| tagIds 1개 인기 (28) | 0.01 | 0.01 | 21 | idx_post_tags_tag_published |  |
| tagIds 1개 희소 (84) | 0.00 | 0.01 | 21 | idx_post_tags_tag_published |  |
| tagIds 3개 + COMPANY | 0.06 | 0.07 | 194 | PRIMARY, idx_post_tags_tag_published | filesort |
| tagIds 3개 + PERSONAL (최악: 유형 희소) | 5.94 | 6.23 | 19244 | PRIMARY, idx_posts_type_published | filesort, temporary_table |
| tagIds 2개 + 작은 소스 3개 (최악) | 3.83 | 3.89 | 11813 | PRIMARY, idx_posts_source_published | filesort, temporary_table |
| 카드: posts JOIN sources | 0.02 | 0.03 | 40 | PRIMARY |  |
| 카드: post_tags JOIN tags | 0.03 | 0.04 | 90 | PRIMARY | filesort |
| 플래그: bookmarks | 0.00 | 0.00 | 21 | idx_bookmarks_user_created |  |
| 플래그: read_histories | 0.01 | 0.01 | 71 | idx_read_histories_user_last_read |  |
| 인기 글 MONTH | 3.59 | 3.68 | 5477 | idx_posts_published | filesort |

- 판정: **전 쿼리 통과**. 가장 느린 경우도 DB p95 6.2ms로 목표(API p95 300ms)에 여유 큼
  - 커서 깊이와 무관하게 21행만 읽음 (1년 전 커서도 0.01ms)
  - `UNION` 분해 효과 확인: 소스·태그 여러 개도 각 21행 × N
  - 최악 조합(인기 태그 × 희소 유형·소스)은 옵티마이저가 `posts` 쪽 인덱스(`idx_posts_type_published`, `idx_posts_source_published`)로 바꿔 탐색함. 1~2만 행 읽고 4~6ms. 인덱스 추가 불필요
  - 인기 글 MONTH: 30일 범위 5,477행 정렬 3.7ms. 10분 캐시 전제로 충분
- 참고 (확인 요청): 커서 시각을 `'2026-11-10T00:00:00.000Z'` 같은 ISO 문자열로 바인딩하면 결과는 맞지만 쿼리마다 `Warning 1292 Truncated incorrect datetime value`가 생김. mysql2에 `Date` 객체를 넘기는 중이면 문제없음. 문자열이면 `YYYY-MM-DD HH:MM:SS.fff`로 바꾸길 권장
- 결론: M2 피드 쿼리에 dba 쪽 추가 요청 없음. M3 검색 측정도 같은 `devfeed_perf`로 진행 예정

## 결정 (pm)
- 결정 (2026-11-19): dba 제안 1~5 채택, server 구현 방식 승인
  - `sourceIds` 2개 이상은 소스별 `UNION ALL`, `tagIds` 2개 이상은 태그별 `UNION`
  - 태그 + 소스/유형 조합은 태그 쪽으로만 분해하고 서브쿼리 안에서 조인 필터 (서브쿼리 최대 10개)
  - 인기 글은 기간별 10분 캐시, `viewCount`는 캐시 시점 값 (F-013 "최대 10분 지연"과 일치)
  - 필터 조합 기능 제한 없음
- 근거: dba 측정에서 위험 2건이 분해 방식으로 페이지당 최대 21 × N행으로 줄어듦. 필터 상한(004)으로 N이 제한됨. 기획 범위 변경 없음
- 후속 작업:
  - server - 구현 후 실제 쿼리를 이 문서에 첨부
  - dba - 서버 쿼리 `ANALYZE` 재확인, M3 대량 시드(10만 건)로 재측정해 D-07에 기록
  - pm - M3 측정에서 태그 + 소스/유형 조합이 p95 300ms 초과 시 새 discussion으로 대안 검토
- 결정 보충 (pm, 2026-11-19, dba 2차 반영)
  - dba 10만 건 측정(`devfeed_perf`)에서 서버 실제 쿼리 전부 통과. 최악 조합(인기 태그 × 희소 유형·소스)도 DB p95 6.2ms → 위 pm 후속 작업(조합 대안 검토)은 불필요로 종결
  - 인덱스 추가 없음
  - server - 커서 시각 바인딩이 ISO 문자열이면 `Date` 객체 또는 `YYYY-MM-DD HH:MM:SS.fff`로 변경 (Warning 1292 제거)
