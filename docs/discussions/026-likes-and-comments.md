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
  - HIDDEN 댓글의 `content`는 관리자 응답에만 원문 포함, 일반 회원·게스트는 `null`. DELETED는 모두 `null`
  - 속도 제한 429 응답에 `retryAfterSec` 포함 (로그인 잠금과 같은 형태)
- 남은 결정 없음. dba 스키마 나오면 명세 초안 올리고 알림

### client (2차, 2026-11-21) — server 2차 반영, mock 선행 구현 완료
- server 2차 형태 그대로 반영: `content`, `likedByMe` 항상 포함, 작성 `201 { comment, commentCount }`, 삭제 `{ commentCount, removed, parentRemoved }`, HIDDEN `content`는 관리자만, 429 `COMMENT_RATE_LIMITED`(`retryAfterSec`는 지금은 안내 문구만 씀)
- **요청 1건**: 관리자 숨김·숨김 해제 응답도 작성처럼 `{ comment, commentCount }`로 받고 싶음. 숨김은 `commentCount`를 바꾸는데 지금 형태(`Comment`만)면 client가 ±1로 추정해야 함. 어렵다면 현행대로 두고 client 추정 유지
- 구현(mock): 반응 줄(`♡ N`·`💬 N`, 1,000 이상 `1.2k`), 낙관적 좋아요(연타 시 마지막 의도만 전송), 댓글 영역(오래된 순 20개 + 더보기, 답글 3개 + "답글 N개 더보기", 답글의 답글은 최상위 id로 보냄), 작성·수정("(수정됨)")·삭제(자리 표시 규칙)·관리자 숨김/해제, 게스트 로그인 안내
- 공개 배포: 응답에 `likeCount`가 없으면 반응 줄을 그리지 않게 해 둠 → 현재 `build:web` 배포본은 화면 변화 없음(확인함). server 배포 후 client 재배포 없이 표시됨. 명세 확정 후 차이만 맞춤
- 검증: 테스트 137건 통과(`reactions.test.tsx` 11건: 게스트 좋아요→로그인 안내·원문 조회 기록 없음, `<script>` 글자 그대로, 답글·댓글 더보기, 연타 후 최종 상태, 실패 롤백, 작성·수정·답글·삭제 자리 표시·수 일치, 속도 제한, 관리자 숨김, 읽은 기록 제외). 캡처 16화면×3폭 + 댓글 펼침 360·1280 라이트·다크 가로 넘침 0

### server (3차) — client 2차 요청 수용
- 관리자 숨김·숨김 해제 응답을 `{ comment, commentCount }`로 함. 숨김 처리 트랜잭션에서 카운터를 바꾼 뒤 그 값을 그대로 돌려주므로 추가 비용 없음
- 이미 숨긴 댓글을 다시 숨기거나 숨기지 않은 댓글을 해제하면 변화 없이 같은 형태로 200 (멱등, 수 변화 없음)
- 명세 초안은 dba 스키마 확정 후 작성함

### pm (검토, 2026-11-21)
- client·server가 합의한 API 형태 승인. 기획 대비 차이 없음
- client 요청(관리자 숨김·해제 응답 `{ comment, commentCount }`) **수용**. 작성·삭제 응답과 형태가 같아지고 client가 수를 추정하지 않아도 됨 → server 명세에 반영
- 공개 배포 방식 승인: 응답에 `likeCount`가 없으면 반응 줄을 숨기는 방식이라 server 배포 전 공개 화면 변화 없음(pm 확인 기준 충족). 단 server는 카운트 필드와 좋아요·댓글 API를 **한 번에** 배포할 것 (필드만 먼저 나가면 버튼이 동작하지 않는 화면이 노출됨)
- mock 캡처 확인(1280 라이트·360 다크 댓글 펼침): 답글 들여쓰기·삭제 자리 표시·관리자 숨김 표시·입력 카운터 정상, 문구 해요체
- 다음: dba 스키마 → server 명세·구현 → 운영 마이그레이션(사용자 확인) → 배포 후 pm 공개 확인

### dba (1차) — 스키마 `0012`·측정·탈퇴 처리 (2026-11-21)
- server 1차 제안을 거의 그대로 채택함. `db/migrations/0012_create_likes_and_comments.sql`
  | 대상 | 내용 |
  |---|---|
  | `posts` | `like_count`, `comment_count` `INT UNSIGNED NOT NULL DEFAULT 0` (`INSTANT`) |
  | `post_likes` | PK `(user_id, post_id)`, `idx_post_likes_post`, `created_at` |
  | `comments` | `post_id`, `parent_id`(NULL=댓글), `user_id`(NULL=자리 표시), `body VARCHAR(1000)`, `status VISIBLE·HIDDEN·DELETED`, `reply_count`, `edited_at`, `hidden_at`·`hidden_by`, 인덱스 `(post_id, parent_id, id)`·`(parent_id, id)`·`(user_id, created_at)` |
- server 제안과 다르게/더 정한 것
  - `reply_count` = **남아 있는 답글 행 수 (VISIBLE + HIDDEN)**. 숨긴 답글도 자리 표시로 보이므로 "답글 N개 더보기"와 자리 표시 판단 모두 이 값 하나로 씀
  - 답글은 삭제하면 항상 행 삭제 (답글은 자식이 없음). 자리 표시는 최상위 댓글만 생김
  - CHECK: `DELETED` ↔ `body`·`user_id` NULL / 그 외 둘 다 필수·1자 이상, `HIDDEN` ↔ `hidden_at` 있음. 작성자가 숨긴 댓글을 지우면 `hidden_at`·`hidden_by`도 비워야 함
  - **`user_id` FK는 RESTRICT** (server 선호대로 `ON DELETE` 자동 처리 안 함). 탈퇴 처리를 빠뜨리면 `users` 삭제가 FK 오류로 실패 → 카운터 어긋남·댓글 원문 잔존을 DB가 막음. `hidden_by`만 `SET NULL` (관리자 탈퇴 대비)
- 쓰기·탈퇴·정합성 SQL: `db/queries/reactions.sql` (server는 같은 순서로 구현 부탁)
  - 좋아요: `INSERT IGNORE`/`DELETE` → 영향 행 1일 때만 카운터 ±1
  - 댓글 작성: 부모 행 `FOR UPDATE` 확인(같은 글·최상위·`DELETED` 아님) → `INSERT` → 부모 `reply_count + 1` → `comment_count + 1`
  - 삭제·숨김 규칙과 `comment_count` 증감 표 (decisions D-21·D-22)
  - 탈퇴: 좋아요 카운터 감소 → 좋아요 삭제 → `comment_count` 감소 → 부모 `reply_count` 감소 → 답글 삭제 → 답글 있는 댓글 자리 표시 → 나머지 댓글 삭제 → 비게 된 자리 표시 정리 → (기존 D-16 순서) → `users` 삭제
  - 정합성 검사 6항목: 좋아요·댓글·답글 수 불일치, 2단계 이상 답글, 빈 자리 표시, `DELETED` 답글 → e2e·운영 점검에 사용
- `db/queries/withdrawal-check.sql`에 `post_likes`·`comments` 추가함 (계약 파일, server e2e 확인 부탁)
- 측정 (`devfeed_perf` 글 14만, 좋아요 50만·댓글 10만·답글 5만, 한 글에 댓글 2,000개, DB p95)
  | 쿼리 | p95 |
  |---|---|
  | 카드 20건 + 카운터 | 0.03ms (기존 카드 조회와 같음) |
  | `likedByMe` 20건 | 0.03ms |
  | 댓글 첫 페이지 / 1,000개 뒤 커서 | 0.07 / 0.01ms |
  | 답글 처음 3개 × 부모 20개 (`ROW_NUMBER`) | 0.14ms |
  | 작성자 닉네임 80명 | 0.47ms |
  | 속도 제한 (1분·24시간) | 0.00ms |
  - 피드·검색 쿼리는 바뀌지 않음 (카운터가 카드 조회의 `posts` 행에 있음) → 기존 p95 유지
- 검증: `devfeed_test`·`devfeed_perf` up → down → up 통과. CHECK·길이·FK 거부 확인. 좋아요 동시 20개 요청 2회 후 행 0/1·카운터 일치. 탈퇴(댓글 15·좋아요 50) 109ms, 잔존 0·정합성 0
- 한계 (pm 참고): 속도 제한을 DB 행으로 세므로 작성 후 삭제한 댓글은 하루 200개 계산에서 빠짐. 1분 5개는 유지돼 스팸 속도는 막힘. 필요하면 Next에서 작성 로그로 보완
- 다음: server 명세 검토. 운영 `devfeed`에 `0012` 적용은 사용자 확인 후 (적용해도 현재 서버 영향 없음: 컬럼 기본값 0, 새 테이블만 추가)

### client (3차, 2026-11-21) — server 3차 반영
- 숨김·숨김 해제 응답 `{ comment, commentCount }`로 바꿈. client의 ±1 추정 제거, 응답 수로 목록 항목을 맞춤. mock도 같은 형태, 테스트에 숨김 후 수 감소·해제 후 복구 확인 추가 (137건 통과)
- 멱등 200은 client 처리 변화 없음. client 쪽 남은 요청 없음 → 명세 초안 나오면 대조함

### pm (dba 1차 검토, 2026-11-21)
- 스키마 `0012` 승인. `reply_count`(VISIBLE+HIDDEN)·답글 항상 행 삭제·`user_id` FK RESTRICT 모두 기획 규칙과 맞음
- 한계(삭제한 댓글이 하루 200개 계산에서 빠짐) **수용**. 1분 5개 제한이 유지돼 도배 속도는 막힘. 작성 로그 보완은 필요해지면 Next
- **사용자 승인 (2026-11-21)**: 운영 `devfeed`에 `0012` 적용 진행 → dba 적용
- 다음: server 명세(`openapi.yaml`)·구현, client 명세 대조, 카운트 필드와 API 한 번에 배포

### dba (2차) — 운영 `devfeed`에 `0012` 적용 완료 (2026-11-21)
- 사용자 승인에 따라 적용. 글 2,607·회원 3·`post_tags` 3,075 전후 동일, `like_count`·`comment_count` 전부 0
- `post_likes`·`comments` 생성 확인, 정합성 검사 6항목 0
- 실행 중인 서버 `/api/health`·`/api/posts`·`/api/security-news`·`/api/search` 200
- server: 구현 배포 후 `db/queries/reactions.sql` 정합성 검사를 운영에서 한 번 더 돌려 결과 공유 부탁

### server (4차) — dba `0012` 검토, 명세 초안 (`openapi.yaml` 반영)
- `0012` 검토: 동의. 1차 제안과 다른 `reply_count`(VISIBLE+HIDDEN)·답글 항상 행 삭제·`user_id` RESTRICT 모두 server 구현에 맞음. `reactions.sql` 순서대로 구현함
  - RESTRICT 영향: e2e 정리(`cleanup`)도 회원 삭제 전에 좋아요·댓글을 탈퇴 순서로 지워야 함 → server가 맞춤
- 정정: 2차에 "`likedByMe`는 `isBookmarked`와 같은 규칙"이라 썼는데 `isBookmarked`는 회원 요청에만 포함됨. `likedByMe`는 client 구현대로 **항상 포함, 비회원 false** 유지 (명세에 차이 명시)
- 경로 (태그 `reactions`)
  | 메서드·경로 | 인증 | 응답 |
  |---|---|---|
  | `PUT`·`DELETE /posts/{postId}/like` | 회원 | `200 LikeState { liked, likeCount }` |
  | `GET /posts/{postId}/comments?cursor&size` | 선택 | `CommentThreadPage` (각 댓글 `replies` 최대 3·`repliesNextCursor`) |
  | `POST /posts/{postId}/comments { content, parentId? }` | 회원 | `201 { comment, commentCount }` |
  | `GET /comments/{commentId}/replies?cursor&size` | 선택 | `CommentPage` |
  | `PATCH /comments/{commentId} { content }` | 본인 | `200 Comment` |
  | `DELETE /comments/{commentId}` | 본인 | `200 { commentCount, removed, parentRemoved }` |
  | `PUT`·`DELETE /admin/comments/{commentId}/hidden` | 관리자 | `200 { comment, commentCount }` |
  - `size` 기본 20, 최대 50
- `Comment`: `id`, `postId`, `parentId|null`, `status`, `content|null`, `author {id, nickname}|null`, `createdAt`, `editedAt|null`, `mine`, `replyCount`
  - DELETED: `content`·`author` null, `mine` false / HIDDEN: 관리자 요청만 `content`·`author` 포함, 그 외 null. `mine`은 HIDDEN이어도 본인이면 true (삭제 메뉴용)
- 정한 세부 규칙
  - 삭제 자리 표시(DELETED)에 답글 작성 → 404. 숨긴 댓글에는 답글 가능 (dba SQL과 같음)
  - 숨긴 댓글 수정 → 409 `COMMENT_HIDDEN`, 삭제는 본인 가능
  - 관리자는 남의 댓글을 삭제하지 않고 숨김만 함 (기획 범위)
  - 속도 제한 429 `COMMENT_RATE_LIMITED` + `retryAfterSec` + `Retry-After`
  - 없는 글 좋아요·댓글 목록 → 404
- 검증: js-yaml로 참조 확인(경로 38개, 깨진 참조 0). 구현은 바로 진행, 카운트 필드와 API는 한 번에 배포 (pm 조건)

### pm (server 명세 검토, 2026-11-21)
- 명세 초안 승인. 경로·응답 형태가 client·server 합의와 pm 결정(숨김 응답 `{ comment, commentCount }`)과 일치
- 세부 규칙 승인: 자리 표시에 답글 404, 숨긴 댓글 답글 허용·수정 409·본인 삭제 허용, 관리자는 숨김만
- 오류 메시지는 해요체(024) 유지
- client는 명세와 mock 차이 대조, server는 배포 후 운영 정합성 검사 결과 공유

### client (4차, 2026-11-21) — 명세 초안(d8f42bc)과 mock 대조·반영
- 그대로 일치: 경로 9개, `LikeState`, `CommentWriteResult`(작성·숨김·해제), `CommentDeleteResult`, `CommentThread.replies`(최대 3)·`repliesNextCursor`, `PostSummary`의 `likeCount`·`commentCount`·`likedByMe`(항상), `size` 기본 20
- 차이 → client·mock 수정함
  - `Comment.postId` 추가
  - `replyCount` = VISIBLE+HIDDEN: "답글 N개 더보기" N을 `replyCount − 받은 답글 수`로 바꿈(기존엔 VISIBLE만 셌음). mock도 같은 기준, 자리 표시로 남길지 판단도 VISIBLE+HIDDEN 답글 기준
  - HIDDEN의 `author`는 관리자에게만: mock 반영 (client는 이미 HIDDEN이면 관리자 아닐 때 작성자 표시 안 함)
  - `mine`은 HIDDEN이어도 true: 숨겨진 내 댓글에 **삭제만** 표시(수정 없음). 테스트 추가
  - 수정 409 `COMMENT_HIDDEN` → "관리자가 숨긴 댓글은 고칠 수 없어요" 안내
  - DELETED 자리 표시에 답글 → 404: client는 원래 VISIBLE 댓글에만 "답글 달기"를 보여 줌. 숨긴 댓글 답글은 server 허용이지만 client는 내용이 안 보이는 댓글에 답글을 유도하지 않으려고 버튼을 두지 않음 (화면 정책, 명세와 충돌 없음)
  - mock: 없는 글 좋아요·댓글 404, 429에 `Retry-After` 헤더
- 검증: 테스트 138건 통과, `build`·`build:web` 통과. 공개 화면은 `likeCount` 수신 전까지 변화 없음 → server 배포 후 실서버 확인하고 알림

### pm (client 4차 확인, 2026-11-21)
- 대조 결과 승인. 숨긴 댓글에 "답글 달기"를 두지 않는 화면 정책 수용 (내용이 안 보이는 댓글에 답글 유도 안 함, API 허용과 충돌 없음)
- 남은 것: server 배포 → 운영 정합성 검사 → client 실서버 확인 → pm 공개 확인·종결

### server (5차) — 구현·배포 완료 (카운트 필드와 API 함께)
- 명세 그대로 구현, :3000 배포 (운영 `devfeed`, `0012` 적용 상태). 공개 응답에 `likeCount`·`commentCount`·`likedByMe` 포함 확인, 댓글 목록 게스트 200·좋아요 게스트 401
- 엔티티: `Post.likeCount`·`commentCount`, `PostLike`, `Comment` (DDL `0012`와 1:1)
- 쓰기 순서는 `reactions.sql`과 같음. 다른 점 1건: **잠금 순서**를 정함 — 회원 행(작성 시) → 글 행 `FOR UPDATE` → 부모 댓글 → 댓글
  - 이유: e2e에서 같은 회원 좋아요 20개 동시 요청 중 일부가 500(데드락). `post_likes` INSERT의 FK 검사가 글 행에 공유 잠금을 잡고, 두 트랜잭션이 같은 글 카운터를 올리려다 서로 막힘. 글 행을 먼저 배타 잠금으로 잡아 해결 (같은 글 쓰기만 직렬화, 측정상 영향 없음). dba `reactions.sql`에도 반영 권장
  - 작성 시 회원 행 잠금은 같은 회원의 동시 작성으로 속도 제한(1분 5개)을 넘는 것을 막음
- 탈퇴: `reactions.sql` 순서 그대로 (`removeReactions`), e2e 정리도 같은 함수 사용
- 검증
  - 단위 128건, e2e 53건 통과 (`reactions.e2e-spec.ts` 7건: 동시 20개 요청·카드 필드·작성 검증·`<script>` 원문·답글 승격·커서·답글 이어 받기·수정·숨김·삭제 자리 표시·속도 제한 429·탈퇴 잔존 0·정합성 6항목 0). 탈퇴 잔존 e2e는 9개 테이블로 갱신
  - 성능 (`devfeed_perf` 글 14만·좋아요 50만·댓글 15만, API p95, `perf/reactions-latency.js`)
    | 경로 | 게스트 | 회원 | 회원 10동시 |
    |---|---|---|---|
    | 최신 피드 | 2.5ms | 3.5ms | 7.8ms |
    | 태그 피드 | 1.0 | 1.3 | 6.0 |
    | 분야 피드 | 2.3 | 1.7 | 7.1 |
    | 인기 글 | 0.2 | 1.0 | 3.7 |
    | 검색 "개발" | 38.4 | 37.4 | 137.5 |
    | 보안 뉴스 | 2.3 | 2.6 | 6.4 |
    | 댓글 2,000개 글 첫 페이지 | 2.0 | 2.1 | 6.9 |
    → 기준 300ms 이하 유지
  - 운영 정합성 6항목 0 (배포 직후)
- client: 실서버 확인 가능. 관리자 숨김은 관리자 계정으로 사용자 확인 필요

### dba (3차) — server 5차 확인, 잠금 순서 반영
- 잠금 순서 동의, `db/queries/reactions.sql`에 반영 (좋아요 켜기·끄기·댓글 작성 첫 단계에 글 행 `FOR UPDATE`, 작성은 회원 행 먼저). decisions D-21에 데드락 원인 기록
  - 내 1차 동시성 시험은 회원 1명·같은 PK 경합이라 FK 공유 잠금 경합이 드러나지 않았음. 회원 여러 명이 같은 글에 동시에 누르는 경우가 실제 데드락 조건
- 재측정 (`devfeed_perf`, 반영한 SQL): 회원 4명이 같은 글에 켜기·끄기 섞어 20개 동시 × 3회 → 오류 0, `like_count` = 실제 행 수
- 운영 `devfeed` 정합성 6항목 0 재확인
- dba 026 작업 끝. 이후 운영 점검 때 정합성 검사 쿼리를 백업 확인과 함께 돌림

### pm (server 배포 확인, 2026-11-21)
- 잠금 순서(글 행 `FOR UPDATE` 먼저) 승인. 회원 여러 명 동시 시험에서 오류 0·수 일치 (server e2e, dba 재측정)
- 공개 페이지 게스트 확인 (Playwright)
  - API: `/posts`·`/security-news` 응답에 `likeCount`·`commentCount`·`likedByMe(false)` 포함
  - 최신·인기·보안 뉴스 항목 우측 하단 `♡ 0  💬 0` 표시
  - `💬` 클릭 → 항목 아래 "아직 댓글이 없어요" + "로그인하고 댓글을 남겨 보세요", 원문 새 창 0
  - `♡` 클릭 → "좋아요를 누르려면 로그인이 필요해요" 모달, 원문 새 창 0
  - 제목 클릭 → 원문(toss.tech) 새 창 유지
  - 360px 가로 넘침 0
- 성능: API p95 최악 검색 회원 10동시 137.5ms, 그 외 10ms 미만 → 300ms 기준 충족
- 남은 것: client 실서버 회원 흐름 확인(좋아요·작성·수정·삭제), 관리자 숨김은 사용자 확인. 이후 종결
