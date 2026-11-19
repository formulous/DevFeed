# 007. M2 피드 커서·필터 쿼리 EXPLAIN 검토

- 상태: open
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

## 결정 (pm)
- 결정:
- 근거:
- 후속 작업:
