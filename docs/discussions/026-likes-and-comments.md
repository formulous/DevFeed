# 026. 글 좋아요·댓글

- 상태: open
- 제기: pm (사용자 요청)
- 관련: dba, server, client
- 관련 문서: `docs/spec/02-features.md` F-080·F-081, `docs/spec/03-screens.md` 글 항목 반응 줄, `docs/spec/04-roadmap.md` M8

## 배경
- 사용자 요청 (2026-11-21): 피드 항목 우측 하단에 좋아요 수·댓글 수 표시, 댓글을 누르면 댓글 목록이 그 자리에서 펼쳐짐. 항목을 누르면 원문으로 바로 이동하는 기존 동작은 유지
- 사용자 결정
  - 반응은 **좋아요 하나만** ('추천' 탭과 이름 겹침 방지)
  - 좋아요·댓글 작성은 **회원만**, 게스트는 수·목록 읽기만
  - 댓글은 **한 단계 답글**까지, 본인 수정·삭제, 관리자 숨김
  - 블로그 글과 **보안 뉴스 모두** 적용
- 포트폴리오 어필: 목록 API에 카운트를 붙여도 p95 유지(카운터 비정규화와 정합성), 좋아요 동시 토글 멱등성, 댓글 트리 페이지네이션, XSS·스팸 방지

## 결정 (pm)

### 글 항목 반응 줄 (F-080·F-081 공통)
```
토스 기술블로그 · 2시간 전  NEW                              ☆
카프카 컨슈머 리밸런싱                                  [썸네일]
요약 2~3줄 ...
#Kafka #Spring                                  ♡ 12   💬 3
```
- 위치: 항목 맨 아래 줄 오른쪽(태그 줄과 같은 줄, 태그가 없으면 단독 줄). 보안 뉴스 항목도 같은 위치
- 항목 본문 클릭 = 지금처럼 원문 새 탭 + 조회수 집계(F-012). 반응 버튼·펼쳐진 댓글 영역 클릭은 원문 이동을 일으키지 않음
- 숫자 0도 표시(`♡ 0`, `💬 0`), 1,000 이상은 `1.2k`
- 적용 화면: 최신(S-01), 추천(S-02), 인기(S-03), 검색(S-04), 북마크(S-08), 보안 뉴스(S-14). 읽은 기록(S-09) 컴팩트 항목은 제외

### F-080 좋아요
- 회원: ♡ 누르면 즉시 ♥·숫자 +1 (낙관적 UI), 다시 누르면 취소. 실패 시 되돌리고 짧은 안내
- 게스트: 누르면 북마크와 같은 로그인 유도 모달
- 한 회원이 한 글에 좋아요 1개. 연타·중복 요청에도 최종 상태와 수가 맞아야 함 (멱등)
- 목록 응답에 글마다 `likeCount`, `commentCount`, 회원이면 `likedByMe` 포함 (항목마다 따로 요청하지 않음)
- 수 반영 지연: 본인 화면은 즉시, 다른 사용자 화면은 목록 캐시 주기(최대 10분)까지 허용
- 좋아요는 이번 범위에서 추천(F-042) 점수에 반영하지 않음 (Next 후보)

### F-081 댓글
- 💬 N 누르면 그 항목 바로 아래에 댓글 영역이 펼쳐지고, 다시 누르면 접힘. 여러 항목을 동시에 펼칠 수 있음. 펼칠 때 처음 불러옴(목록 로딩 때 댓글 본문은 안 가져옴)
```
#Kafka #Spring                                  ♡ 12   💬 3 ▴
 ┌──────────────────────────────────────────────────────────┐
 │ 닉네임A · 1시간 전                          수정 · 삭제    │
 │ 리밸런싱 시간 줄이는 설정 참고됐어요                          │
 │   답글 달기                                                │
 │   └ 닉네임B · 30분 전                                     │
 │     저도 같은 문제 겪었어요                                  │
 │ 삭제된 댓글이에요                                           │
 │   └ 닉네임C · 10분 전 ...                                  │
 │ [ 댓글 더보기 ]                                            │
 │ ┌ 댓글을 남겨 주세요 (최대 1,000자) ─────────────┐ [등록]   │
 │ └──────────────────────────────────────────────┘          │
 └──────────────────────────────────────────────────────────┘
```
- 정렬: 댓글은 오래된 순, 처음 20개 + "댓글 더보기"(커서). 답글은 부모 아래 오래된 순, 처음 3개 + "답글 N개 더보기"
- 답글은 1단계만. 답글에 답글 달기는 부모 댓글에 다는 것으로 처리
- 작성: 회원만. 게스트는 입력창 자리에 "로그인하고 댓글을 남겨 보세요" + 로그인 링크(돌아오면 같은 화면)
- 내용: 1~1,000자 일반 텍스트. HTML·마크다운 해석 안 함, 줄바꿈만 유지, 앞뒤 공백 제거. 링크 자동 변환 안 함
- 수정·삭제: 본인만. 수정하면 "(수정됨)" 표시. 답글이 있는 댓글을 삭제하면 "삭제된 댓글이에요" 자리 표시로 남고 답글은 유지, 답글이 없으면 완전히 사라짐
- 관리자: 모든 댓글에 "숨김" 메뉴. 숨긴 댓글은 "관리자가 숨긴 댓글이에요"로 표시, 숨김 해제 가능
- `commentCount` = 보이는 댓글 + 답글 수 (삭제·숨김 제외)
- 속도 제한: 회원당 댓글 작성 1분 5개·하루 200개, 초과 시 "잠시 후 다시 남겨 주세요"
- 탈퇴(F-032): 좋아요 삭제(수 감소), 댓글은 내용 삭제 후 위 삭제 규칙 적용(답글 있으면 "삭제된 댓글이에요"). 개인정보 안내(S-11) 문구 추가
- 알림(답글 알림 등)은 범위 밖

### 비기능
- 목록 API에 카운트 포함 후에도 피드·검색 p95 300ms 이하 (글 10만 건 기준, 기존 측정과 같은 조건). 방식(카운터 컬럼·집계 테이블 등)은 dba·server 결정
- 좋아요 수·댓글 수가 실제 행 수와 어긋나지 않음 (동시 토글·삭제·탈퇴 후 검증)
- 화면 문구 해요체 (024)

## 수용 기준
- 위 6개 화면에서 항목 우측 하단 `♡ N 💬 N` 표시, 항목 본문 클릭 시 원문 이동 유지, 반응 영역 클릭 시 원문 이동 없음
- 게스트 좋아요 → 로그인 유도, 게스트 댓글 목록 읽기 가능·작성 불가
- 같은 회원이 좋아요를 20번 동시 요청해도 최종 수 0 또는 1, `likedByMe`와 일치
- 댓글·답글 작성·수정·삭제·관리자 숨김, 삭제 자리 표시 규칙 동작
- `<script>` 등 입력이 글자 그대로 보임
- 탈퇴 후 해당 회원 좋아요·댓글 내용 0건, 수 일치
- 10만 건 피드·검색 p95 300ms 이하 유지
- 360px에서 반응 줄·댓글 영역 가로 넘침 없음, 라이트·다크 확인

## 후속 작업
- dba - 좋아요·댓글 스키마(카운터 방식 포함), 마이그레이션, 탈퇴 처리 대상 추가
- server - `openapi.yaml`(목록 응답 카운트 필드, 좋아요 토글, 댓글 CRUD·숨김) → 구현·e2e·성능 측정
- client - 반응 줄·댓글 영역(server 배포 전에는 mock, 공개 배포는 server 배포 후)
- pm - `02-features.md` F-080·F-081, `03-screens.md` 반응 줄·S-11, `04-roadmap.md` M8 (완료)
- 진행 순서: dba 스키마 → server 명세 검토 → 구현. 운영 DB 마이그레이션은 사용자 확인 후 적용

## 의견

### client (1차, 2026-11-21) — 화면 구조와 화면에 필요한 API 형태
- 반응 줄은 공통 `PostCard` 하단(태그 줄 오른쪽)에 붙여 6개 화면에 한 번에 적용. 보안 뉴스도 `PostSummary`를 쓰므로 같은 컴포넌트. 읽은 기록(S-09)은 prop으로 끔
  - 현재 항목 전체가 원문 링크(`a::after` 덮개)라 반응 버튼·댓글 영역은 덮개 위(`z-10`)에 두고 클릭 전파를 막음
  - 댓글 영역은 `article` 바로 아래 형제로 펼침(덮개 밖) → 영역 안 클릭이 원문 이동을 일으키지 않음
- 공개 배포 시점: 목록 응답에 `likeCount`가 **없으면 반응 줄을 그리지 않음**. 별도 플래그 없이 server 배포 전 `build:web`에서는 자동으로 숨고, 배포되면 바로 보임. mock(dev·테스트·캡처)은 필드를 채워 선행 개발
- server에 바라는 형태 (명세 작성 시 참고, 이름·경로는 server 결정 따름)
  - `PostSummary`에 `likeCount: integer`, `commentCount: integer`, `likedByMe?: boolean`(회원만) — 피드·추천·인기·검색·북마크·보안 뉴스 목록 전부
  - 좋아요: `PUT /posts/{id}/like`·`DELETE /posts/{id}/like` (멱등, 북마크와 같은 패턴) → `200 { liked, likeCount }`. 응답의 수로 낙관적 값을 맞춤. 게스트는 401
  - 댓글 목록: `GET /posts/{id}/comments?cursor&size=20` → `CursorPage<Comment>`, 각 댓글에 답글 처음 3개 `replies[]`와 `replyCount` 포함(펼칠 때 요청 1번으로 첫 화면 완성)
  - 답글 더보기: `GET /comments/{id}/replies?cursor&size` → `CursorPage<Comment>`. 첫 커서는 댓글 목록 응답의 `repliesNextCursor`로 주면 중복 없이 이어 받을 수 있음
  - 작성: `POST /posts/{id}/comments { content, parentId? }` → `201 Comment` + 새 `commentCount`. 답글의 답글은 server가 부모로 올려 처리(client는 클릭한 댓글의 최상위 id를 보냄)
  - 수정: `PATCH /comments/{id} { content }` → `Comment` / 삭제: `DELETE /comments/{id}` → `200 { commentCount, removed: boolean }` (자리 표시로 남는지 완전히 사라지는지 client가 알아야 함)
  - 관리자 숨김: `PUT`·`DELETE /admin/comments/{id}/hidden` → `Comment`
  - `Comment`: `id`, `parentId|null`, `status: VISIBLE|DELETED|HIDDEN`, `content|null`(DELETED·HIDDEN이면 null, 관리자에겐 HIDDEN 원문 포함 희망), `author { id, nickname }|null`, `createdAt`, `editedAt|null`, `mine: boolean`, `replyCount`, `replies?`, `repliesNextCursor?`
  - 오류 `code`: `COMMENT_RATE_LIMITED`(429, "잠시 후 다시 남겨 주세요"), `VALIDATION_FAILED`(빈 값·1,000자 초과), `NOT_FOUND`(삭제된 글·댓글), `FORBIDDEN`(남의 댓글 수정)
- 화면 처리
  - 좋아요: 낙관적 토글, 연타는 마지막 의도만 서버에 반영(진행 중이면 다음 요청 대기). 실패 시 되돌리고 토스트. 게스트는 로그인 유도 모달(북마크와 같은 문구 패턴)
  - 댓글: 펼칠 때 처음 요청, TanStack Query 캐시(`['comments', postId]`)라 접었다 펴도 재요청 없음. 작성·삭제 후 목록의 `commentCount`도 같이 갱신
  - 내용은 React 텍스트 노드로만 렌더(`whitespace-pre-wrap`) → HTML 해석 없음. 입력은 1,000자 카운터, 앞뒤 공백 제거 후 빈 값이면 등록 비활성
  - 게스트: 입력창 자리에 "로그인하고 댓글을 남겨 보세요" + `/login?redirect=<현재 경로+쿼리>`
- 360px: 반응 줄은 태그 줄과 같은 줄, 태그는 줄바꿈되고 반응은 오른쪽 고정. 답글 들여쓰기 12px로 제한
- 진행: 위 형태로 mock 선행 구현 시작. 명세가 확정되면 차이를 맞춤

### server (1차) — 스키마 전 조회·쓰기 패턴 의견 (dba 참고용)
- **카운터는 `posts` 비정규화 컬럼 제안** (`like_count`, `comment_count`, `INT UNSIGNED NOT NULL DEFAULT 0`)
  - 카드 조립은 이미 글 ID 목록으로 `posts`를 읽으므로 추가 조인·집계 없음 → 피드·검색 p95 영향 거의 0
  - 좋아요·댓글 쓰기와 **같은 트랜잭션**에서 증감. 정합성 검증 쿼리(실제 행 수 vs 카운터)를 dba `db/queries/`에 두면 e2e·운영 점검에 씀
- **좋아요 `post_likes`**: PK `(user_id, post_id)` + `idx_post_likes_post (post_id)` (FK·글 삭제), `created_at`
  - 멱등: `INSERT IGNORE` → `affectedRows = 1`일 때만 `like_count + 1`, 취소는 `DELETE` → 1일 때만 `- 1`. 20번 동시 요청도 PK가 직렬화하므로 수 0/1 보장
  - `likedByMe`: 카드 ID 목록에 `WHERE user_id = ? AND post_id IN (...)` → PK 범위 조회 (북마크 플래그와 같은 방식)
- **댓글 `comments`** (제안 컬럼): `id`, `post_id`, `parent_id NULL`, `user_id NULL`(탈퇴 시 NULL), `body VARCHAR(1000)`(utf8mb4), `status` (`VISIBLE`·`DELETED`·`HIDDEN`), `reply_count`(보이는 답글 수), `edited_at NULL`, `created_at`, `updated_at`
  - 최상위 목록(오래된 순·커서): `idx_comments_post_parent (post_id, parent_id, id)` → `WHERE post_id = ? AND parent_id IS NULL AND id > ? ORDER BY id LIMIT 21`
  - 답글 처음 3개(부모 20개 분): `idx_comments_parent (parent_id, id)` → `ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY id) <= 4`로 한 번에. "답글 N개 더보기"의 N은 부모 `reply_count` 사용
  - 삭제 규칙: 보이는 답글이 있으면 `status = DELETED` + `body` 비움(자리 표시), 없으면 행 삭제. 마지막 답글이 지워져 자리 표시 부모만 남으면 부모도 정리 → 이 판단에 `reply_count` 필요
  - 숨김은 `status = HIDDEN` + `hidden_at`·`hidden_by`(관리자 ID) 정도면 충분. 숨김 해제 시 `VISIBLE` 복귀
  - 작성자 닉네임은 `users` 조인 (댓글 20 + 답글 최대 60 → PK 조회)
- **속도 제한**(1분 5개·하루 200개): DB 기준으로 셈 → `idx_comments_user_created (user_id, created_at)` 필요. 서버 재시작에도 유지되고 정확함
- **탈퇴**: 좋아요 행 삭제 + `like_count` 감소, 댓글은 내용 삭제 후 위 삭제 규칙 적용 + `user_id = NULL`. FK는 `ON DELETE` 대신 서버 탈퇴 트랜잭션에서 순서대로 처리하는 걸 선호함 (카운터를 같이 맞춰야 해서). `withdrawal-check.sql`에 두 테이블 추가 부탁
- **캐시 영향**: 인기 글 카드 캐시(10분)에 수가 들어가면 다른 사용자에게 최대 10분 지연 → pm 허용 범위. `likedByMe`는 북마크처럼 캐시 밖에서 회원별로 붙임
- **API 방향 (명세는 스키마 확정 뒤 작성)**
  - 좋아요는 토글 대신 **원하는 상태 지정**: `PUT /posts/{id}/like`, `DELETE /posts/{id}/like` → `{ liked, likeCount }`. 연타·재시도해도 최종 상태가 요청과 같아서 멱등 수용 기준에 맞음
  - 댓글: `GET /posts/{id}/comments?cursor=`(답글 3개씩 포함), `GET /comments/{id}/replies?cursor=`, `POST /posts/{id}/comments { body, parentId? }`, `PATCH`·`DELETE /comments/{id}`, 관리자 `PUT`·`DELETE /admin/comments/{id}/hidden`
  - 목록 응답 `PostSummary`에 `likeCount`·`commentCount`(필수)·`likedByMe`(회원만, 비회원 `false`)
  - 본문은 서버에서 앞뒤 공백 제거·1~1,000자 검증만 하고 HTML 이스케이프는 하지 않음 (원문 그대로 저장, client가 텍스트로 렌더링)

### server (2차) — client 1차 제안 검토
- 제안 형태 그대로 명세에 반영 예정 (스키마 확정 후 `openapi.yaml` 작성). server 1차 방향과 경로·멱등 방식 일치
- 맞춘 것: 본문 필드 이름은 client 제안 `content` 사용 (server 1차의 `body` 대신). `likedByMe`는 비회원 응답에서 생략 대신 **항상 포함, 비회원 `false`** (`isBookmarked`와 같은 규칙, client 분기 단순)
- 추가할 것
  - 삭제 응답: `{ commentCount, removed, parentRemoved }` — 마지막 보이는 답글을 지워서 "삭제된 댓글이에요" 자리 표시 부모까지 정리되는 경우 `parentRemoved: true`
  - 작성 응답: `201 { comment, commentCount }` (Comment에 카운트를 섞지 않음)
  - 관리자 응답에서만 HIDDEN·DELETED가 아닌 HIDDEN 원문 `content` 포함, 일반 회원·게스트는 `null`
  - 속도 제한 429 응답에 `retryAfterSec` 포함 (로그인 잠금과 같은 형태)
- 남은 결정 없음. dba 스키마 나오면 명세 초안 올리고 알림
