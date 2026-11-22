# 032. 커뮤니티 탭 (사용자 글·토론)

- 상태: open
- 제기: pm (사용자 요청)
- 관련: dba, server, client
- 관련 문서: `docs/spec/02-features.md` F-090~F-094, `docs/spec/03-screens.md` S-16~S-18·A-05, `docs/spec/04-roadmap.md` M12

## 배경
- 사용자 요청 (2026-11-22): 기술 뉴스·보안 뉴스(031)에 더해, 사용자가 기술 글을 올리고 토론하는 탭을 만듦
- 사용자 결정
  - 글 형식: 마크다운 + 코드 블록 (이미지 업로드 없음)
  - 말머리: 질문·토론·공유, 질문글은 답 채택 가능
  - 운영: 신고 + 관리자 숨김 + 작성 제한
  - 점수: 글 +10 (하루 3개분), 내 글이 받은 좋아요 작성자 +1

## 결정 (pm)
### 탭·주소
- 1단 탭 3개: 기술 뉴스 / 보안 뉴스 / **커뮤니티**
- 커뮤니티 내부 탭 `[최신 | 인기]` + 말머리 필터 `전체 · 질문 · 토론 · 공유` (분야 탭 자리, 같은 글자 탭)
| 화면 | 주소 | 접근 |
|---|---|---|
| S-16 커뮤니티 > 최신 | `/community?category=question\|discussion\|share` | 전체 |
| S-16 커뮤니티 > 인기 | `/community/popular?period=&category=` | 전체 |
| S-17 글 상세 | `/community/posts/:id` | 전체 (숨김 글은 작성자·관리자만) |
| S-18 글 쓰기·수정 | `/community/new`, `/community/posts/:id/edit` | 회원 (수정은 작성자) |
| A-05 신고 관리 | `/admin/reports` | 관리자 |
- 비회원이 "글쓰기"를 누르면 로그인 유도 모달 (031 추천 탭과 같은 방식)

### 글 (F-090)
- 필드: 말머리(1개 필수), 제목(2~100자), 본문(마크다운 10~20,000자), 태그 0~5개 (기존 태그 사전에서 고름, 새 태그 만들지 않음)
- 마크다운 범위: 문단·제목(h2~h4)·굵게·기울임·목록·인용·표·링크·인라인 코드·코드 블록(언어 지정, 하이라이트)
  - **원시 HTML 금지, 이미지 문법은 링크 텍스트로만 표시** (외부 이미지 추적·유해 이미지 차단)
  - 링크는 `http(s)`만, `rel="nofollow ugc noopener noreferrer"`, 새 탭
  - 저장은 원문 마크다운, 표시할 때 안전 필터(sanitize) 거침. XSS 방어는 server·client 둘 다 책임 (server: 저장 전 길이·금지 패턴 검사, client: 허용 목록 렌더러). 표시 방식 세부는 server·client 합의
- 작성 화면: [작성 | 미리보기] 탭, 임시 저장(브라우저 저장, 새로고침 후 복구), 떠날 때 경고
- 수정: 작성자만, 수정되면 "수정됨" 표시. 삭제: 작성자·관리자. 답글이 달린 글을 삭제하면 "삭제된 글이에요"로 남기고 댓글은 유지
- 목록 카드: 말머리 배지·제목·본문 앞 2줄(마크다운 제거 텍스트)·작성자(아바타·닉네임·등급 배지)·시간·태그·반응 줄(♡·💬). 질문글은 `해결됨` 배지
  - 카드 클릭 = 상세로 이동 (외부 원문이 없으므로 기술 뉴스와 다름)
- 인기: 기간 24시간/7일/30일 발행 글, 점수 = 좋아요 × 2 + 댓글 수 + 조회수 × 0.1 상위 20건, 최대 10분 지연. 기준이 기술 인기와 다른 이유: 내부 글이라 반응이 조회보다 신호가 강함

### 반응·답 채택 (F-091)
- 좋아요(F-080)·댓글·답글 1단계(F-081) 그대로 재사용. 상세 화면은 댓글이 기본으로 펼쳐짐
- 질문글 작성자는 다른 사람의 최상위 댓글 1개를 채택 (변경·취소 가능). 채택 댓글은 맨 위 고정 + `채택` 표시, 목록에 `해결됨`
- 채택된 댓글은 작성자가 삭제할 수 없음 (수정은 가능). 관리자 숨김은 가능하고 숨기면 채택도 풀림

### 신고·숨김·작성 제한 (F-092)
- 신고 대상: 커뮤니티 글 + 모든 댓글 (기술·보안 뉴스 댓글 포함). 사유 `스팸 | 욕설·비방 | 개인정보 노출 | 기타(200자)`
- 회원 1명이 같은 대상에 1회. 자기 글·댓글은 신고 불가
- 서로 다른 회원 3명이 신고하면 **자동 임시 숨김** → 관리자 확인 대기. 관리자가 "문제없음" 처리하면 다시 보이고 그 대상은 자동 숨김 제외
- 관리자 A-05: 대기 중 신고 목록(대상·사유별 수·미리보기), 숨김·해제·문제없음 처리. 숨김/해제는 기존 관리자 댓글 숨김(026)과 같은 상태 값 사용
- 작성 제한 (관리자 예외)
  - 가입 24시간 안 된 계정은 글 작성 불가 (댓글은 가능), 안내 문구 표시
  - 글 하루 5개 (KST 자정 기준), 글 사이 최소 60초
  - 초과 시 429 + 남은 시간 안내

### 점수 (F-083 확장, F-093)
| 활동 | 점수 | 기준 |
|---|---|---|
| 글 쓰기 | +10 | 하루 처음 3개분 (029 댓글처럼 회수된 것도 개수에 포함), 삭제·숨김 시 회수, 숨김 해제 시 복구 |
| 내 글이 받은 좋아요 | 작성자 +1 | 좋아요 1개당, 취소 시 회수. 자기 글 좋아요는 0, 하루 최대 50점 |
| 답 채택됨 | 0 | 이번 범위 밖 (어뷰징 검토 후 Next) |
- 기존 읽기 +1 (같은 글 처음 1회, 하루 30점)은 커뮤니티 글 상세 열람에도 똑같이 적용
- 등급 안내 다이얼로그(030)에 새 규칙 2줄 추가

### 프로필 카드 (F-082 확장)
- 수치에 "글" 추가: `글 · 좋아요 · 댓글 · 읽은 글 · 북마크` 5칸. 좁으면 client가 배치 조정

### 이번에 하지 않는 것 (Next)
- 이미지 업로드, 검색에 커뮤니티 글 포함, 답 채택 점수, 알림(내 글에 댓글), 투표(추천/비추천), 글 북마크 외 구독
  - 북마크·읽은 기록은 기존 기능 그대로 커뮤니티 글에도 적용 (목록에서 구분 표시)

## 각 역할 검토 요청
- dba: 커뮤니티 글 저장 구조(기존 `posts`에 종류 추가 vs 별도 테이블 — 좋아요·댓글·북마크·읽은 기록·점수 원장 재사용이 쉬운 쪽), 신고 테이블, 채택 컬럼, 작성 제한 집계, 원장 새 종류(`POST_WRITE`, `LIKE_RECEIVED`). 마이그레이션은 운영 적용 전 사용자 승인
- server: API 명세(글 CRUD·목록·인기·채택·신고·관리자 신고 처리), 마크다운 검증·sanitize 방침, 작성 제한(429), 잠금 순서(026 규칙에 신고·채택 포함), 인기 캐시
- client: 화면 S-16~S-18·A-05, 마크다운 에디터·미리보기·안전 렌더러, 1단 탭 3개 360px 배치, 프로필 카드 5칸, 등급 안내 문구

## 순서
1. dba 스키마 초안 → server 검토 → 사용자 승인 후 운영 적용
2. server API 명세 → client·pm 검토 → 구현·배포 (client는 명세 확정 뒤 mock 병행)
3. client 화면 배포 → pm 공개 확인 (작성·수정·삭제·채택·신고 3건 자동 숨김·작성 제한·XSS 문자열 무해화) 후 종결

## 수용 기준
- 회원이 말머리·태그와 함께 마크다운 글을 쓰고, 코드 블록이 하이라이트되어 보임. 미리보기와 결과가 같음
- `<script>`·`<img onerror>`·`javascript:` 링크·원시 HTML이 담긴 글이 실행되지 않고 무해하게 표시됨
- 질문글 채택·변경·취소, 목록 `해결됨` 표시
- 서로 다른 3명 신고 시 자동 숨김, 관리자 숨김·해제·문제없음 처리
- 가입 24시간 이내·하루 5개·60초 제한 동작, 관리자 예외
- 점수: 글 +10(하루 3개분)·받은 좋아요 +1(하루 50) 적립·회수, 프로필 카드 수치와 원장 일치
- 커뮤니티 목록·상세 p95 300ms 이하, 360px 가로 넘침 0, 라이트·다크 정상
- 기존 기술 뉴스·보안 뉴스 목록과 인기에 커뮤니티 글이 섞이지 않음

## 의견

### client 1차 (2026-11-22)
화면 범위 동의함. 명세 확정 전까지는 설계만 하고, mock은 server 명세가 나온 뒤 붙임. 화면 쪽 방침과 dba·server에 요청할 사항을 정리함.

#### 저장 구조 (dba 검토에 대한 client 의견)
- 기존 `posts`에 종류를 추가해 **id 공간을 공유**하는 쪽을 선호함
  - 이유: 좋아요(`/posts/{id}/like`)·댓글(`/posts/{id}/comments`)·북마크·읽은 기록·관리자 댓글 숨김(026) 화면 코드를 그대로 재사용할 수 있음
  - 별도 테이블이면 client 쪽 API 모듈·캐시 키·mock을 따로 만들어야 해서 작업량이 늘어남. 최종 결정은 dba·server에 맡김
- 북마크·읽은 기록 응답 항목에 글 종류(예: `kind: BLOG | SECURITY_NEWS | COMMUNITY`)가 필요함
  - 기존 카드는 누르면 외부 원문을 새 탭으로 열고 조회를 기록함. 커뮤니티 글은 상세 화면(`/community/posts/:id`)으로 가야 해서, 종류를 보고 분기함

#### 마크다운 표시 (XSS 방어 client 측)
- 렌더러: `react-markdown` + `remark-gfm`(표), **`rehype-raw`는 쓰지 않음**
  - 원시 HTML은 DOM으로 만들지 않고 글자 그대로 보임. `<script>`, `<img onerror>`는 실행되지 않고 텍스트로만 표시됨
  - `dangerouslySetInnerHTML`을 쓰지 않음. 결과는 전부 React 요소라 속성 주입 경로가 없음
- 허용 요소만 렌더링함 (`allowedElements`): 문단·h2~h4·굵게·기울임·목록·인용·표·링크·인라인 코드·코드 블록·구분선
  - `#` h1은 h2로, h5·h6은 h4로 낮춰 표시함 (상세 화면 제목과 위계 충돌 방지)
  - 이미지 `![alt](url)`는 `<img>`를 만들지 않고 `alt` 글자(+링크 규칙)로만 표시함
- 링크: `urlTransform`으로 `http:`·`https:`만 남기고 나머지(`javascript:`, `data:`, `vbscript:`, 상대 경로)는 링크를 없애고 글자만 표시함. `target="_blank" rel="nofollow ugc noopener noreferrer"`
- 코드 블록: `highlight.js` core에 언어 약 15개(java, kotlin, js/ts, python, go, sql, bash, yaml, json, xml, dockerfile, rust, c/cpp 등)만 등록함. 모르는 언어는 하이라이트 없이 표시함. 블록마다 복사 버튼
- 번들: 렌더러·하이라이터는 커뮤니티 상세·작성 화면에서만 지연 로드함 (예상 gzip 약 55KB). 기술·보안 뉴스 첫 화면 번들은 늘지 않음
- **미리보기와 결과가 같아야 함** → 작성 화면 미리보기와 상세 화면이 같은 컴포넌트를 씀. server가 별도로 HTML을 만들어 내려주지 않는 방식(원문 마크다운 그대로 응답)을 제안함
- 수용 기준의 XSS 문자열(`<script>`, `<img src=x onerror>`, `[a](javascript:alert(1))`, `<a href=...>`, `<iframe>`, `![x](https://track)`)은 client 테스트에 그대로 넣음

#### 작성 화면 (S-18)
- 에디터는 `textarea`(모노 글꼴)로 만듦. 코드 에디터 라이브러리(CodeMirror 등)는 번들 대비 이득이 작아 쓰지 않음
  - Tab/Shift+Tab 들여쓰기, Esc 후 Tab은 포커스 이동 (키보드 갇힘 방지)
- 임시 저장: `localStorage` 키를 회원 id + 대상(new 또는 글 id)으로 나눔. 1초 디바운스 저장, 올리기 성공 시 삭제. 다른 계정으로 로그인하면 보이지 않음
- 떠날 때 경고: 내용이 바뀐 경우만 `beforeunload` + 라우터 이동 차단 확인창
- 태그는 설정 화면의 `TagPicker`를 재사용함 (최대 5)

#### server API에 요청할 형태
1. **목록 항목에 `excerpt`(마크다운 제거한 앞부분 약 200자)** 를 내려줬으면 함. 목록에서 본문 전체를 받지 않고 마크다운 파서도 불러오지 않기 위함
2. 목록·상세 공통: `id, category(QUESTION|DISCUSSION|SHARE), title, excerpt, author{id,nickname,grade}, createdAt, editedAt|null, tags, likeCount, commentCount, viewCount, solved, liked, bookmarked`
3. 상세 추가: `body`(원문 마크다운), `status(VISIBLE|HIDDEN|DELETED)`, `acceptedCommentId|null`, `reportedByMe`. 수정·삭제 버튼은 `author.id === me.id` 또는 관리자로 client가 판단함
4. **작성 가능 여부 사전 조회** (예: `GET /community/write-status` → `{allowed, reason: NEW_ACCOUNT|DAILY_LIMIT|COOLDOWN|null, availableAt|null, remainingToday}`)
   - 화면 설계상 작성 제한이면 버튼 대신 사유·남은 시간을 보여줘야 함. 다 쓴 뒤 429로 알게 되면 내용을 날리는 경험이 됨
   - 429 응답에도 `code`와 `availableAt`(또는 `retryAfterSeconds`)을 본문에 넣어 주길 바람 (헤더만으로는 오류 처리 공통 코드에서 다루기 번거로움)
5. 댓글 응답에 `reportedByMe`. 채택 댓글 고정은 상세의 `acceptedCommentId`로 client가 맨 위에 올림 (댓글 목록 정렬은 지금 그대로 둬도 됨)
6. 채택: `PUT /community/posts/{id}/accepted-comment {commentId}` / `DELETE` 같은 형태면 충분함. 오류 코드로 자기 댓글·답글·질문글 아님을 구분해 주길 바람
7. 신고: `POST /reports {targetType: POST|COMMENT, targetId, reason, detail?}`. 중복 신고(409)·자기 글 신고(403)는 각각 다른 `code`
8. `/me/profile` `stats`에 `posts` 추가
9. 목록은 기존과 같은 커서 페이지(`CursorPage`)로 맞춰 주면 무한 스크롤 코드를 재사용할 수 있음

#### 그 외 화면 방침
- 1단 탭 3개: 360px에서 "기술 뉴스 · 보안 뉴스 · 커뮤니티" 한 줄에 들어감(지금 탭 글자 크기 기준 약 230px). 넘치면 기존 가로 스크롤 규칙 유지
- 커뮤니티 내부 탭 `[최신 | 인기]`는 031 `SectionTabs`에 섹션 하나 추가. 말머리 필터는 분야 탭 자리에 같은 글자 탭으로 둠. 탭 이동 시 `category`만 유지
- 프로필 카드 5칸: 좁은 사이드바(256px)에선 `3+2` 두 줄로 배치함
- 등급 안내 다이얼로그(030)에 "글 쓰기 +10점 (하루 3개분)", "내 글이 받은 좋아요 +1점 (하루 50점)" 2줄 추가
- A-05는 기존 관리자 표 스타일 그대로 씀

#### pm 확인 요청
- 삭제된 글(댓글 있음)은 목록에 남기는지, 상세 주소로만 접근 가능한지. client 제안: **목록에서는 빼고 상세에서만 "삭제된 글이에요"**
- 숨김 글은 작성자 본인의 목록에도 안 보이는 것으로 이해함. 맞는지

### server (사전 의견) — dba 초안 전에 조회·쓰기 패턴 공유
dba 초안 작성에 참고. 최종 검토는 초안이 나온 뒤에 함

#### 저장 구조
- server 선호: `posts`에 `kind = 'COMMUNITY'` 행 + 1:1 확장 테이블 (예: `community_posts(post_id PK/FK, user_id, category, body, status, accepted_comment_id, edited_at, hidden_*)`)
  - 이유: `post_likes`·`comments`·`bookmarks`·`read_histories`·`score_events(READ/LIKE)`·`post_tags`·카드 조회(`PostCardsService`)·조회수 기록이 모두 `posts.id` 기준이라 그대로 재사용됨. 별도 테이블이면 이 6~7곳이 두 갈래가 됨
  - 걸리는 점: `posts.source_id`·`url`·`url_hash`(UK)·`source_type`이 NOT NULL. 커뮤니티 행은 NULL 허용이 필요하고, 그 경우 UK·FK·CHECK를 dba가 정리 부탁
  - 목록 본문 앞 2줄은 `posts.summary`(300자)에 server가 쓰기 시점에 마크다운을 걷어낸 텍스트로 저장 → 목록이 20KB 본문을 읽지 않게 함
  - 본문 20,000자 utf8mb4는 최대 80KB라 `TEXT`(64KB) 초과 → `MEDIUMTEXT` 필요
- 기존 목록 분리: 블로그 목록·인기·추천은 `kind = 'BLOG'`, 보안 뉴스는 `kind = 'SECURITY_NEWS'`로 이미 명시해서 거름. 검색은 `post_search`(수집 시 채움)라 커뮤니티 글이 들어가지 않음. 구현 때 `FROM posts` 쿼리 13개 파일을 다시 확인함
  - `post_tags.kind` ENUM에도 `COMMUNITY` 추가 필요 (태그 필터·태그별 글 수에서 섞이지 않게)

#### 조회 패턴 (인덱스 검토 요청)
| 용도 | 조건·정렬 | 비고 |
|---|---|---|
| 최신 목록 | 보이는 글, `category` 선택, `(published_at, id)` 커서 | 말머리 필터 커서용 인덱스 필요 (`posts`에 비정규화하거나 확장 테이블에 `(category, status, published_at, id)` 등) |
| 인기 | 기간 안 보이는 글, `like×2 + comment + view×0.1` 상위 20 | 기술 인기처럼 기간 범위 스캔 후 정렬, 10분 캐시. 커뮤니티 규모면 충분할 것으로 봄 |
| 작성 제한 | 회원의 KST 오늘 글 수, 마지막 작성 시각 | `(user_id, created_at)` 인덱스. 회원 행 `FOR UPDATE` 후 계산(댓글 속도 제한과 같은 방식) |
| 프로필 "글" 수 | 회원의 보이는 글 수 | 위 인덱스로 `COUNT` |
| 신고 대기 목록 | 대상별 신고 수·사유별 수, 대기 상태만 | 아래 |

#### 신고
- 제안: 신고 행 테이블 + 대상 요약 테이블 2개
  - `reports(target_type POST|COMMENT, target_id, reporter_id, reason, detail, created_at)` UK `(target_type, target_id, reporter_id)` → 1인 1회를 `INSERT IGNORE` 영향 행으로 판단
  - `report_targets(target_type, target_id, report_count, state PENDING|HIDDEN|CLEARED, ...)` → 관리자 목록 커서·"문제없음 후 자동 숨김 제외" 상태·신고 동시성 잠금 지점. 3번째 신고는 이 행 `FOR UPDATE` 후 `report_count`로 판단
- 자동 숨김: 댓글 `hidden_by`가 지금은 관리자 ID라 자동 숨김을 구분할 값 필요 (`hidden_by NULL` + 사유 컬럼 등)

#### 채택
- `accepted_comment_id`를 글 쪽에 두고 FK → comments `SET NULL` 정도 예상. 채택 댓글 삭제 거부·숨김 시 해제는 server가 글 행 잠금 아래에서 처리

#### 점수 원장 (dba 결정 필요)
- `POST_WRITE`: `ref_id = post_id`, 회수 있음 → `revoked_at` CHECK(지금 COMMENT만)에 포함 필요
- `LIKE_RECEIVED`: PK `(user_id=작성자, kind, ref_id)`인데 한 글에 좋아요가 여러 명이라 `ref_id = post_id`로는 중복됨. 좋아요 1건을 가리킬 값이 필요 (예: `post_likes`에 대리 키 추가 후 그 id, 또는 원장 키 확장). dba 판단 부탁
- 잠금 순서: 커뮤니티 글 좋아요는 누른 회원 + 작성자 회원 2행을 잠가야 함. 서로의 글을 동시에 좋아요하면 교차 잠금이 생기므로 **회원 행은 id 오름차순**으로 잠그고 그 뒤 글 → 댓글 → 원장 (026·029 순서에 포함)

#### pm 확인 요청 (3건)
1. 하루 50점 넘은 받은 좋아요: 읽기처럼 행을 남기지 않음(취소·재좋아요 시 다시 계산) vs 댓글처럼 0점 행 남김. server 제안은 **행 남기지 않음** (취소 시 회수 대상만 명확)
2. 답글 달린 글을 삭제해 "삭제된 글이에요"로 남은 글이 목록·인기에 계속 나오는지. server 제안은 **목록·인기에서 제외, 상세 주소로만 접근**
3. 탈퇴 회원의 커뮤니티 글: 지금 댓글처럼 남기고 작성자 "탈퇴한 회원" 표시 vs 삭제. 탈퇴 처리 순서(`withdrawal-check`)에 영향이 있어 스키마 전에 정해 주면 좋음

### pm (client 1차 답변, 2026-11-22)
- 삭제된 글(댓글 있음): client 제안 채택. **목록(최신·인기·북마크·읽은 기록 포함)에서 빼고**, 상세 주소로만 "삭제된 글이에요" + 댓글 표시. 댓글 없는 글 삭제는 상세도 404
- 숨김 글: 이해 맞음. **모든 목록에서 빠짐**(작성자 본인 포함, 지금은 내 글 목록 화면 없음). 상세는 작성자·관리자만 "숨겨진 글이에요" 표시와 함께 열람, 그 외 404. 작성자에게는 숨김 사유 대신 "신고 검토 중이거나 관리자가 숨긴 글이에요" 한 줄
  - 숨김·삭제 글의 점수 회수는 F-093 그대로. 숨김 글의 좋아요·댓글 작성은 막음(409), 이미 있는 반응은 유지
- 렌더 방침(원문 마크다운 응답, `rehype-raw` 미사용, 허용 요소·`http(s)` 링크만, 이미지 텍스트화, 지연 로드) 수용. pm 기획의 "server·client 둘 다 책임" 중 표시 단계는 client, server는 길이·형식 검사와 저장 원문 보존으로 정리
- API 형태 요청 1~9: pm 의견으로는 모두 타당함. 특히 `write-status` 사전 조회와 429 본문 `code`·`availableAt`은 화면 수용 기준(내용 날림 방지)상 필요하다고 판단. 최종 명세는 server가 dba 스키마 기준으로 확정
- 저장 구조(`posts` id 공간 공유)는 dba·server 판단에 맡김. 다만 북마크·읽은 기록 응답에 `kind`가 있어야 한다는 요구는 수용 기준으로 둠

### server (client 1차·pm 답변 확인)
- client 요청 1~9 원칙적으로 수용. 최종 형태는 dba 초안 확정 뒤 명세에서 정함. 지금 정해 둘 것만 적음
  - 필드 이름은 기존 `PostSummary`에 맞춤: `isBookmarked`·`isRead`·`likedByMe` (client 제안의 `liked`·`bookmarked` 대신). 커뮤니티 카드는 `PostSummary` 확장으로 두고 `kind`를 모든 카드에 추가 (북마크·읽은 기록 분기용)
  - `excerpt`는 쓰기 시점에 server가 마크다운을 걷어내 저장한 값 (`posts.summary` 재사용 예정)
  - 429는 기존 댓글 제한과 같은 형태로 `code`(`POST_RATE_LIMITED` 등 사유별)·`retryAfterSec` 본문 + `Retry-After` 헤더, 여기에 `availableAt` 추가. `write-status`와 같은 계산 함수를 씀
  - 좋아요·댓글·답글은 기존 `/posts/{id}/like`·`/posts/{id}/comments` 그대로. 숨김·삭제 글 반응 409는 그 경로에 추가
  - server는 렌더하지 않고 원문 보존 + 길이·형식 검사만 함 (pm 정리 수용). 저장 전 원문을 바꾸지 않음 (미리보기와 결과 일치)
- pm 답변 수용 (삭제·숨김 글 모든 목록 제외). server 사전 의견의 pm 확인 1(받은 좋아요 한도 초과)·3(탈퇴 회원 글)은 답 대기
- dba 초안 대기

### pm (server 확인 요청 3건 답변, 2026-11-22)
1. 하루 50점 넘은 받은 좋아요: server 제안 채택, **행을 남기지 않음** (읽기 +1 한도 초과와 같은 방식). 취소 시 행이 있는 것만 회수, 다음 날 재좋아요는 다시 계산. 받는 사람이 통제할 수 없는 점수라 "회수분 포함 계산"(글·댓글)보다 단순한 쪽이 맞음
2. 삭제 자리 글: client 답변과 같음. **목록·인기·북마크·읽은 기록에서 제외, 상세 주소로만**
3. 탈퇴 회원 글: **댓글(026)과 같은 규칙**. 탈퇴 시 제목·본문·태그 삭제 + `user_id NULL`, 댓글이 있으면 "삭제된 글이에요" 자리만 남기고 없으면 행 삭제. 개인정보 안내(S-11) "탈퇴 시 개인 데이터 즉시 삭제" 원칙과 맞춤
   - 그 글에 다른 회원이 단 댓글·좋아요와 그로 얻은 점수(댓글 +5·좋아요 +2)는 유지. 탈퇴 회원의 신고 행은 `reporter_id` 연결만 끊고 신고 수 유지(자동 숨김 판단이 탈퇴로 뒤집히지 않게)
   - client: S-11 문구에 "커뮤니티 글도 같은 방식" 한 줄 추가, `withdrawal-check`에 커뮤니티 글·신고 포함은 dba
- 저장 구조(`posts` + 1:1 확장, NULL 허용·`MEDIUMTEXT`·`post_tags.kind`), 신고 2테이블, 원장 `LIKE_RECEIVED` 키, 회원 행 id 오름차순 잠금은 dba 초안에서 확정. pm 이견 없음

### client (server 확인·pm 답변 3건 확인)
- 필드 이름 `isBookmarked`·`isRead`·`likedByMe`와 `PostSummary` 확장 + 전 카드 `kind` 수용. 기존 카드 코드 그대로 씀
- 429 `code`·`retryAfterSec`·`availableAt`, `write-status` 같은 계산 수용. 화면은 `availableAt` 기준으로 남은 시간을 표시함
- 숨김·삭제 글 반응 409: 상세에서 좋아요·댓글 입력을 미리 비활성화하고, 409가 와도 토스트만 띄움
- 탈퇴 글 규칙 수용. S-11 개인정보 안내와 탈퇴 확인 창 목록에 "커뮤니티 글" 한 줄 추가는 커뮤니티 화면 배포 때 함께 반영함 (지금 넣으면 없는 기능 안내가 됨)
- dba 초안·server 명세 대기

### dba (1차) — 스키마 초안 `0015` (server 사전 의견·pm 답변 반영)
- `db/migrations/0015_create_community.sql`, 쿼리 `db/queries/community.sql`, 결정 D-25
- **저장: `posts`(`kind = 'COMMUNITY'`) + 1:1 확장 `community_posts`** (server·client 선호와 같음)
  | 테이블 | 내용 |
  |---|---|
  | `posts` | `kind`·`post_tags.kind`에 `COMMUNITY` 추가 (`INSTANT`). `title`, `summary`(= 마크다운 걷어낸 excerpt, server가 저장 시 생성), 카운터·조회수 그대로 |
  | `community_posts` | `post_id` PK/FK, `user_id`(RESTRICT), `category`, `body MEDIUMTEXT`(10~20,000자 CHECK), `status VISIBLE·HIDDEN·DELETED`, `accepted_comment_id`(FK SET NULL), `published_at`(복사), `edited_at`, `hidden_at·hidden_by·hidden_reason` |
  | `report_targets` | PK `(target_type, target_id)`, `report_count`, `state PENDING·HIDDEN·CLEARED`, 처리자·시각, `(state, last_reported_at)` 인덱스 |
  | `reports` | UK `(target_type, target_id, reporter_id)`, `reason SPAM·ABUSE·PRIVACY·OTHER`, `detail`(OTHER만), 신고자 FK SET NULL, 대상 FK → `report_targets` |
  | `comments` | `hidden_reason ADMIN·REPORTS` 추가 (기존 숨김은 `ADMIN`으로 채움) |
  | `score_events` | `POST_WRITE`·`LIKE_RECEIVED` 추가, **PK에 `actor_id`(기본 0) 추가** → LIKE_RECEIVED 키 = (작성자, post_id, 누른 회원) |
- server 사전 의견의 "NOT NULL 컬럼 NULL 허용" 대신: **내부 소스 1행**(`internal:community`, `kind = 'COMMUNITY'`, `INACTIVE` → 수집 스케줄러 대상 아님)을 `source_id`로 쓰고, `url`은 삽입 직후 정식 주소(`{base}/community/posts/{id}`)로 갱신. `posts` 재구성·API `url` 필수 계약 변경이 없음
  - server 확인 부탁: 관리자 소스 목록·통계, `/security-news/sources` 등 `FROM sources` 쿼리에서 `kind = 'COMMUNITY'` 제외 (`/sources`는 이미 `BLOG`만)
- **삭제는 항상 `DELETED` 상태로 남김** (행 삭제 없음). 행을 지우면 CASCADE로 다른 회원의 좋아요·북마크·읽은 기록이 사라지고 그 회원들의 원장 LIKE 점수가 어긋남. pm 화면 규칙(목록 제외, 댓글 있으면 "삭제된 글이에요", 없으면 404)은 상태와 `comment_count`로 처리. 삭제 시 본문·작성자 NULL, `posts.title` 빈 값, 태그 삭제, POST_WRITE 회수
  - 탈퇴(pm: 댓글 규칙): 같은 처리. `community_posts.user_id`가 RESTRICT라 빠뜨리면 회원 삭제가 실패함. `withdrawal-check.sql`에 `community_posts`·`reports(reporter_id)` 추가 (14개 테이블)
- 신고 흐름: 대상 행 upsert → 대상 행 `FOR UPDATE` → `INSERT IGNORE` 신고(영향 1이면 `report_count + 1`) → 3건 이상이고 `PENDING`이면 `HIDDEN` + 대상 숨김(`hidden_reason = 'REPORTS'`, 점수 회수, 채택 해제). `CLEARED`는 이후 자동 숨김 없음
- 점수: 글 +10 하루 처음 3개(회수 포함), 받은 좋아요 +1 하루 50점(초과분 행 없음, 자기 글 0). **작성 제한(5개·60초)도 POST_WRITE 행으로 셈** → 삭제한 글도 셈
- 잠금 순서: 회원 행(행위자·글 작성자 두 명이면 **id 오름차순**, server 제안 그대로) → 글 → 확장 → 부모 댓글 → 댓글 → 신고 대상 → 원장
- 정합성 검사 7항목 (`community.sql` 끝): 확장 없는 커뮤니티 글, 잘못된 채택, 신고 수 불일치, POST_WRITE 회수 불일치, 좋아요 없는 LIKE_RECEIVED, 검색 색인된 커뮤니티 글 등
- 검증: `devfeed_test`·`devfeed_perf` up → down → up 통과 (perf 14초, 운영 규모는 즉시). CHECK·FK 거부 6종 확인. 시나리오(롤백): 글 4개 → 30점, 서로 다른 3명 신고 → 자동 숨김, 중복 신고 0, 받은 좋아요 켜기·끄기
- 측정 (`devfeed_perf` 커뮤니티 2만 건, DB p95): 최신·말머리 커서 0.01ms, 카드 20건 0.05ms, 인기 MONTH 0.99ms·말머리 0.35ms, 프로필 글 수 0.01ms → 기준 300ms 대비 여유 큼
- 다음: server 검토 → 사용자 승인 후 운영 적용

### pm (dba 초안 확인, 2026-11-22)
- 기획과 맞음. 다음 2가지는 pm 답변을 dba안으로 바꿔 수용
  - 탈퇴·삭제 시 "댓글 없으면 행 삭제" → **항상 `DELETED` 상태로 남김** (다른 회원의 좋아요·북마크·읽은 기록·점수 보존). 화면 규칙(목록 제외, 댓글 없으면 404)은 그대로
  - 작성 제한(하루 5개·60초)에 삭제한 글도 포함 → 지우고 다시 쓰기로 제한을 피하지 못하게 하는 쪽이라 수용
- 내부 소스 1행(`internal:community`) 방식: 관리자 소스 목록·통계·보안 출처에서 빠지는지 server 확인 조건으로 수용
- server 검토가 끝나면 pm이 사용자에게 운영 적용(0015) 승인을 받음

### server (dba 1차 검토) — 0015 동의, 참고 쿼리 1건 수정 + 확인 5건
- 구조 동의: `posts` + `community_posts`, 내부 소스 1행, 항상 soft delete, 신고 2테이블, 원장 `actor_id`, 잠금 순서. 조회 패턴(말머리 커서·인기·작성 제한·프로필 글 수)이 모두 인덱스로 처리됨 확인
- 기존 server 코드 호환: 원장 INSERT는 컬럼을 지정하므로 `actor_id` 기본 0으로 그대로 동작(READ `INSERT IGNORE`·ARCHIVE 접기 포함). `posts`/`post_tags` ENUM 추가도 영향 없음

#### 수정 요청 (`community.sql` 참고 쿼리)
1. **신고 2건에 자동 숨김됨**: `UPDATE report_targets SET report_count = report_count + 1, ..., state = IF(... report_count + 1 >= 3 ...)` 에서 MariaDB 단일 테이블 UPDATE는 왼쪽부터 대입하므로 `state` 식의 `report_count`가 이미 +1된 값임 (`SIMULTANEOUS_ASSIGNMENT` 꺼짐). `devfeed_test` 임시 테이블로 확인: `report_count 1 → 2`에서 `HIDDEN`. `state`를 먼저 쓰거나 `report_count >= 3`으로 바꿔야 함. server 구현은 `report_count >= 3`(대입 후 값)으로 씀. 시나리오 검증에 "2명 신고는 숨김 아님" 추가 부탁

#### 확인 5건
2. **배포 순서**: `ck_comments_hidden`이 `hidden_reason NOT NULL`을 요구하므로 0015 적용 후 지금 server의 관리자 댓글 숨김(`hidden_reason` 안 씀)이 CHECK 위반 500이 됨. server는 0015 적용 직후 바로 배포함. 운영 적용 시각을 알려 주면 맞춤 (관리자 숨김만 영향, 사용 빈도 낮음)
3. **댓글 행 삭제 시 신고 대상 고아**: `report_targets`는 대상 FK가 없어서 답글 삭제·자리 표시 정리·탈퇴 댓글 삭제 때 남음. server가 댓글 `DELETE`와 같은 트랜잭션에서 `report_targets`(→ `reports` CASCADE)도 지움. 정합성 검사에 "대상 없는 신고 대상" 항목 추가 부탁
4. **정식 url의 `@base_url`**: server 설정 `WEB_BASE_URL`(기본 `http://localhost:5175`)을 새로 둠. 운영 `.env`에 값 추가가 필요해 0015와 함께 사용자에게 요청할 예정 (값은 공개 웹 주소)
5. **내부 소스 노출**: server가 관리자 소스 목록·수정·통계, 수집 스케줄러·수동 수집, 카탈로그에서 `kind = 'COMMUNITY'`를 제외함. 관리자가 상태를 `ACTIVE`로 바꾸는 것도 거부 (수집기가 `internal:community`를 가져가지 않게)
6. 탈퇴·삭제 시 숨김 글: soft delete UPDATE가 `hidden_*`를 NULL로 비우는 것 확인 (CHECK 통과). 관리자 "숨김 해제"는 `report_targets.state = CLEARED`로 둠 (해제 후 자동 숨김 제외, pm 규칙과 같음)

- 0015 자체는 수정 없이 승인 의견. 1·3은 참고 쿼리·정합성 검사 쪽 변경
- 다음: dba 답 받으면 `openapi.yaml` 명세 작성 → client·pm 검토
