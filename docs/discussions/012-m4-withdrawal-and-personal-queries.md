# 012. M4 탈퇴 잔존 검사와 개인화 쿼리 검토

- 상태: open
- 제기: dba
- 관련: server, pm
- 관련 문서: `db/queries/withdrawal-check.sql`, `db/queries/personal.sql`, `docs/schema/decisions.md` D-02·D-08·D-10, 002 결정 9번

## 배경
- M4 착수. 002 결정으로 탈퇴(F-032) 후 개인 데이터 잔존 e2e가 필수임
- dba가 실제 DB의 FK 구성을 확인하고, 잔존 검사 쿼리와 개인화 쿼리를 `devfeed_perf`(회원 1만, 북마크 50만, 읽은 기록 191만)에서 검증함

## 확인 결과

### 1. 회원과 연결된 데이터 전체 목록 (`devfeed` 실측)
| 테이블 | 연결 방식 | 탈퇴 처리 |
|---|---|---|
| `refresh_tokens` | FK `ON DELETE CASCADE` | 자동 삭제 |
| `user_interest_tags` | FK `ON DELETE CASCADE` | 자동 삭제 |
| `bookmarks` | FK `ON DELETE CASCADE` | 자동 삭제 |
| `read_histories` | FK `ON DELETE CASCADE` | 자동 삭제 |
| `recommendation_impressions` | `user_id` (FK 없음, D-10) | 서버가 같은 트랜잭션에서 `user_id = NULL` |
| `post_view_guards` | `viewer_key` = `SHA2('u:'+id)` 앞 16바이트 (D-08) | 24시간 내 자동 소멸. 즉시 삭제 권장 (아래) |

### 2. 탈퇴 트랜잭션 시뮬레이션 (`devfeed_perf`, 실행 후 롤백)
- 대상: 읽은 기록이 가장 많은 회원 (읽은 기록 400, 북마크 15, 관심 태그 4) + 리프레시 토큰·추천 노출·조회 guard 각 1건 추가
- 순서: `UPDATE recommendation_impressions SET user_id = NULL` → `DELETE post_view_guards WHERE viewer_key = ?` → `DELETE users`
- 결과: 7개 테이블 잔존 **0건**, 소요 **78ms**, 추천 노출 행은 익명으로 유지 (클릭률 집계 보존)
- 잔존 검사 쿼리: `db/queries/withdrawal-check.sql` (`@uid`, `@vkey`만 넣으면 테이블별 남은 건수). e2e에서 그대로 쓰는 것을 권장

### 3. `post_view_guards` 즉시 삭제 (선택, server 판단)
- `viewer_key`만으로는 인덱스가 없어 전체 스캔이지만, 테이블은 하루치 고유 조회 수로 크기가 제한돼 비용이 작음
- 즉시 삭제하면 e2e에서 "탈퇴 직후 잔존 0"을 7개 테이블 모두로 단정할 수 있음. 안 지우면 e2e에서 이 테이블은 검사 제외해야 함

### 4. 개인화 쿼리 (`db/queries/personal.sql`, `ANALYZE`)
| 쿼리 | 인덱스 | 실제 읽은 행 |
|---|---|---|
| 북마크 목록 커서 | `idx_bookmarks_user_created` | 21 |
| 북마크 + 태그 필터 | 위 + `post_tags` PK | 67 (태그 일치까지 순회, 최대 회원 북마크 수 5,000) |
| 북마크 수 (5,000 제한) | `idx_bookmarks_user_created` | 회원 북마크 수 |
| 읽은 기록 목록 커서 | `idx_read_histories_user_last_read` | 21 |
| 1년 보관 삭제 배치 | `idx_read_histories_last_read` | 배치 크기 이하 |
- 모두 인덱스만으로 처리됨. 스키마 변경 필요 없음

## 의견

### dba (1차)
- 스키마 변경 없이 M4 진행 가능. server는 탈퇴 트랜잭션 순서(2번)와 잔존 검사 쿼리 사용 여부, 3번 즉시 삭제 여부를 회신 바람

### pm (1차)
- 3번 즉시 삭제는 기획 요구로 정함: F-032 "탈퇴 시 개인 데이터 삭제"는 즉시 삭제가 원칙. 회원 ID에서 만든 `post_view_guards.viewer_key`도 탈퇴 트랜잭션에서 지움. e2e는 7개 테이블 모두 잔존 0으로 단정
- 2번 순서·잔존 검사 쿼리 사용은 server 회신 후 확정

### server (1차)
- 2번 트랜잭션 순서 그대로 채택: `UPDATE recommendation_impressions SET user_id = NULL` → `DELETE post_view_guards WHERE viewer_key = ?` → `DELETE users` (같은 트랜잭션)
  - `viewer_key`는 서버의 `viewerKey({ userId })`(`SHA-256('u:'+id)` 앞 16바이트)로 계산. `UNHEX(LEFT(SHA2(CONCAT('u:', id), 256), 32))`와 같은 값
- 3번 즉시 삭제 채택 (pm 결정과 동일). e2e에서 7개 테이블 전부 0건을 단정함
- 잔존 검사 쿼리: e2e가 `db/queries/withdrawal-check.sql` 파일을 그대로 읽어 같은 연결에서 `SET @uid, @vkey` 후 실행함. 파일이 바뀌면 e2e도 자동으로 따라감 (사본을 두지 않음)
- 4번 개인화 쿼리 형태(북마크·읽은 기록 커서, 태그 필터 EXISTS, 5,000 제한 COUNT)도 그대로 사용
- 탈퇴 직후 남은 액세스 토큰(최대 15분)으로 들어오는 쓰기 요청은 FK 오류(1452)를 401 `UNAUTHENTICATED`로 바꿔 응답하고, 조회 기록은 읽은 기록 저장만 건너뜀

## 결정 (pm)
- 결정 (2026-11-19, pm 범위): `post_view_guards` 회원 행은 탈퇴 트랜잭션에서 즉시 삭제. 나머지(트랜잭션 순서, `withdrawal-check.sql` 사용)는 server 회신 후 기록
- 근거: 개인 데이터 즉시 삭제 원칙, 테이블이 하루치 크기라 전체 스캔 비용 작음, e2e 단정 범위가 단순해짐
- 후속 작업:
  - server - 탈퇴 트랜잭션에 guard 삭제 포함, e2e에서 `withdrawal-check.sql` 기준 7개 테이블 잔존 0 검사
