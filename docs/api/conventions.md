# API 공통 규칙

- 작성: server
- 상태: 초안 v1 (2026-11-19)
- 명세 본문: `openapi.yaml` (이 문서와 충돌하면 이 문서를 기준으로 명세를 고침)

## 1. 기본
- Base URL: `/api` (1인 서비스라 URL 버전 없음. 호환 깨짐은 7절 절차로 관리)
- 형식: `application/json; charset=utf-8`
- 필드 이름: camelCase
- 시각: ISO 8601 UTC 문자열 (`2026-11-19T01:23:45.000Z`). 서버·DB 모두 UTC로 저장하고 표시용 변환은 client가 함
- ID: 정수(number). 글 10만·회원 1만 규모라 `Number.MAX_SAFE_INTEGER` 문제 없음
- nullable 필드는 키를 빼지 않고 `null`로 내려줌
- 관리자 API는 `/api/admin/**` 아래에 둠
- enum 값은 UPPER_SNAKE 문자열 (`USER`/`ADMIN`, `COMPANY`/`PERSONAL`, `ACTIVE`/`ERROR`/`INACTIVE`)
- 목록 크기 파라미터 이름은 커서·페이지 모두 `size`로 통일
- 기간 파라미터(인기 글 `period`, 검색 `period`)는 요청 시각 기준 롤링 윈도우. 관리자 "오늘"만 Asia/Seoul 자정 기준

## 2. 응답 형식

### 단건
리소스 객체를 그대로 반환함 (envelope 없음)
```json
{ "id": 1, "title": "..." }
```

### 커서 목록 (무한 스크롤: 최신 피드, 북마크, 읽은 기록)
```json
{
  "items": [ ... ],
  "nextCursor": "eyJ0IjoiMjAyNi0xMS0xOVQwMTowMDowMFoiLCJpIjoxMjN9"
}
```
- 북마크 목록만 `total`(전체 북마크 수)을 추가로 내려줌 (S-08 개수 표시)
- 요청: `?cursor=<nextCursor>&size=20`
- 첫 페이지는 `cursor` 생략. `nextCursor`가 `null`이면 마지막 페이지
- 커서는 불투명(opaque) 문자열임. client는 해석·조작하지 않음
  - 내부적으로는 정렬 키 `(정렬시각, id)`의 base64url 인코딩. 정렬 키가 `(시각 DESC, id DESC)`라 스크롤 중 새 글이 들어와도 중복·누락 없음
- 필터 값이 바뀌면 커서를 버리고 첫 페이지부터 다시 요청함
- `size` 기본 20, 최대 50

### 페이지 목록 (검색, 관리자 목록)
```json
{
  "items": [ ... ],
  "page": 1,
  "size": 20,
  "total": 132
}
```
- 요청: `?page=1&size=20` (page는 1부터)
- 검색은 `page` 최대 50 (상위 1,000건까지만 탐색 가능). 깊은 OFFSET 비용 차단 목적

### 본문 없음
- 생성이 아닌 상태 변경(북마크 해제, 로그아웃 등)은 `204 No Content`

## 3. 에러 형식
```json
{
  "code": "VALIDATION_FAILED",
  "message": "요청 값이 올바르지 않아요",
  "fieldErrors": [ { "field": "q", "message": "검색어는 2~50자로 입력해 주세요" } ]
}
```
- `code`: 기계 판독용 상수. client 분기 기준은 HTTP status가 아니라 `code`
- `message`: 사용자에게 그대로 보여도 되는 한국어 문장. 화면 문구와 같이 해요체로 씀 (024, 예: `로그인이 필요해요`). `code`가 판단 기준이고 `message`는 표시용
- `fieldErrors`: 필드 검증 오류일 때만 존재, 그 외 생략

### 공통 에러 코드
| HTTP | code | 상황 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 요청 값 검증 실패 (`fieldErrors` 포함) |
| 400 | `INVALID_CURSOR` | 커서 해석 불가 |
| 401 | `UNAUTHENTICATED` | 토큰 없음·형식 오류 |
| 401 | `TOKEN_EXPIRED` | 액세스 토큰 만료 → client는 refresh 후 1회 재시도 |
| 403 | `FORBIDDEN` | 권한 없음 (관리자 API 등) |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `CONFLICT` | 중복 등 상태 충돌 (세부 코드가 있으면 그것을 씀) |
| 429 | `RATE_LIMITED` | 요청 과다 |
| 500 | `INTERNAL_ERROR` | 서버 오류 (내부 정보 노출 없음) |

### 기능별 에러 코드
| HTTP | code | 상황 |
|---|---|---|
| 409 | `EMAIL_DUPLICATED` | 가입 이메일 중복 |
| 401 | `INVALID_CREDENTIALS` | 이메일·비밀번호 불일치 (어느 쪽이 틀렸는지 구분하지 않음) |
| 423 | `LOGIN_LOCKED` | 로그인 5회 실패로 잠김. 응답에 `retryAfterSec` 포함, `Retry-After` 헤더 동시 설정 |
| 401 | `REFRESH_TOKEN_INVALID` | 리프레시 토큰 만료·폐기·재사용 감지 → 재로그인 |
| 409 | `SOURCE_FEED_DUPLICATED` | 같은 피드 URL 소스 존재 |
| 422 | `SOURCE_FEED_INVALID` | 피드 URL이 유효한 RSS/Atom 아님 (`message`에 사유) |
| 409 | `CRAWL_ALREADY_RUNNING` | 해당 소스 수집 실행 중 |
| 422 | `BOOKMARK_LIMIT_EXCEEDED` | 북마크 5,000건 초과 |
| 403 | `PASSWORD_MISMATCH` | 탈퇴 시 비밀번호 재확인 실패 |
| 409 | `SOURCE_INACTIVE` | 비활성 소스 즉시 수집 요청 |
| 409 | `SOURCE_NOT_IN_ERROR` | 오류 상태가 아닌 소스 재개 요청 |
| 429 | `COMMENT_RATE_LIMITED` | 댓글 작성 속도 제한(1분 5개·24시간 200개) 초과. 응답에 `retryAfterSec`, `Retry-After` 헤더 (026) |
| 409 | `COMMENT_HIDDEN` | 관리자가 숨긴 댓글 수정 요청 (026) |
| 409 | `TAG_DUPLICATED` | 태그 이름·slug 중복 |
| 409 | `SYNONYM_DUPLICATED` | 동의어가 다른 태그에 이미 있음 |
| 409 | `JOB_ALREADY_RUNNING` | 같은 종류 백그라운드 작업 실행 중 |

## 4. 인증
- 액세스 토큰: JWT, 유효 15분, `Authorization: Bearer <token>` 헤더
  - 응답 본문으로만 전달. client는 메모리에만 보관 (localStorage 저장 금지)
- 리프레시 토큰: 불투명 랜덤 문자열, 유효 14일
  - `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` 쿠키로만 전달
  - `Secure`는 환경변수 `COOKIE_SECURE`(기본 `true`)로 제어. dev에서 Safari 확인 시에만 `false`로 둠 (Safari가 `http://localhost`의 Secure 쿠키를 저장하지 않는 경우 대응)
  - DB에는 해시만 저장. 재발급 시마다 교체(rotation), 이미 쓴 토큰이 다시 오면 해당 계열 전체 폐기
- 새로고침 후 로그인 복원: 앱 시작 시 `POST /api/auth/refresh` 호출
- 게스트 허용 API에 토큰이 있으면 회원 정보(북마크 여부, 읽음 여부)를 포함해 응답함. 토큰이 만료됐으면 게스트로 처리하지 않고 `TOKEN_EXPIRED` 반환 (client가 refresh 후 재시도)
- 권한: `USER`, `ADMIN` 두 단계

## 5. 비회원 식별자
- 조회수 24시간 중복 제외(F-012)용
- 서버가 첫 요청에 `df_vid` 쿠키(UUID, `HttpOnly; SameSite=Lax`, 1년) 발급
- client는 별도 처리 불필요 (same-origin 프록시라 쿠키 자동 전송)

## 6. 검증·보안
- 문자열 입력은 앞뒤 공백 제거 후 검증
- 검색 하이라이트(F-022): 서버는 HTML을 만들지 않음. client가 검색어 토큰으로 일치 구간을 찾아 텍스트 노드로 렌더링함 (`dangerouslySetInnerHTML` 금지)
- CORS: 개발 환경은 Vite dev server 프록시로 same-origin 처리. 서버는 CORS를 열지 않음
- 요청 본문이 필요한 삭제성 동작은 `DELETE` 대신 `POST`를 씀 (예: 탈퇴 `POST /me/withdraw`). DELETE 본문은 프록시·라이브러리별로 버려질 수 있음

## 6-1. 운영 (M6, 014)
- 모든 응답에 `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`
- 속도 제한: IP 기준. 초과 시 429 `RATE_LIMITED` + `Retry-After`(초). IP는 nginx가 넘긴 `X-Forwarded-For`(서버는 loopback 프록시만 신뢰)
  | 대상 | 한도 |
  |---|---|
  | 기본 (모든 API) | 1분 120회 |
  | `POST /auth/signup` | 10분 5회 |
  | `POST /auth/login` | 1분 10회 (계정별 5회 실패 잠금과 별개) |
  | `POST /auth/refresh` | 1분 30회 |
  | `GET /search` | 1분 60회 |
  | `POST /posts/{id}/views` | 1분 60회 |
  | `GET /health` | 제한 없음 |
- 헬스 체크 `GET /health`: 정상 200 `{ status: OK, db: OK }`, DB 실패 503

## 7. 버전·변경
- 호환이 깨지는 변경은 discussion 합의 후 `openapi.yaml`을 먼저 고치고 구현함
- 필드 추가는 호환 변경으로 간주함. client는 모르는 필드를 무시해야 함
