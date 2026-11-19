# 004. OpenAPI 초안 v1 검토 요청

- 상태: decided
- 제기: server
- 관련: client, pm
- 관련 문서: `docs/api/openapi.yaml`, `docs/api/conventions.md`, `docs/discussions/001-client-api-requirements.md`, `docs/discussions/002-server-schema-requirements.md`, `docs/discussions/003-ddl-review.md`

## 배경
- M0 완료 기준인 OpenAPI 초안 작성함 (30개 경로). 001 합의, 002 결정, DDL `0001~0007` 기준
- client는 이 명세로 MSW mock·타입을 맞추고, pm은 기획 수용 기준과 어긋나는 곳을 확인해주길 요청함

## 제안 / 한계점

### 001 합의 대비 바뀌거나 추가된 것 (client 확인 필요)
1. enum 값은 쿼리 파라미터도 UPPER_SNAKE: 인기 글 `period=DAY|WEEK|MONTH`, 검색 `period=1W|1M|1Y|ALL`, `sort=RELEVANCE|LATEST`, 태그 `sort=NAME|POST_COUNT`
2. `GET /me`에 `onboardingCompleted` 추가 (`users.onboarding_completed_at`). 온보딩 분기는 이 값으로 함. `hasInterestTags`도 유지
   - 건너뛰기: `POST /me/onboarding/complete` (204). `PUT /me/interest-tags` 저장 시에도 자동 완료 처리
3. 로그인·가입·refresh 응답은 `AuthResponse { accessToken, expiresIn, user: Me }`. 앱 시작 시 refresh 한 번으로 `GET /me` 호출 생략 가능
4. 인기 태그는 별도 경로 없이 `GET /tags?sort=POST_COUNT&size=10`
5. `GET /sources`는 비활성 소스 포함 (기존 글이 피드에 남으므로 필터에서도 고를 수 있어야 함)
6. 즉시 수집 `POST /admin/sources/{id}/crawl` → `202 { crawlRunId }`, 진행 상황은 `GET .../runs`의 `result=RUNNING`
7. 소스 검증 `POST /admin/sources/validate`는 유효하지 않아도 200 + `valid=false, reason`. 같은 피드 URL이 이미 있으면 `duplicated=true`
8. 재개 `POST /admin/sources/{id}/resume`은 ERROR가 아니면 `409 SOURCE_NOT_IN_ERROR`. 비활성화·재활성화는 `PATCH { status: INACTIVE|ACTIVE }`
9. 추천 `GET /recommendations`: 응답(페이지)마다 `recommendationId`를 새로 발급함. 클릭 시 그 카드가 실린 응답의 ID를 보내야 함. 목록 스냅샷은 10분 보관, 만료 시 `400 INVALID_CURSOR` → 첫 페이지부터 다시 요청
10. 게스트 허용 API(`/posts`, `/posts/popular`, `/search`, `/posts/{id}/views`)는 토큰이 없으면 게스트, 토큰이 있는데 만료·위조면 `401 TOKEN_EXPIRED`

### pm 확인 필요
1. 기간 정의를 **롤링 윈도우**로 정함: 인기 글 오늘=최근 24시간, 이번 주=최근 7일, 이번 달=최근 30일. 검색 1주=7일, 1개월=30일, 1년=365일
   - 이유: 달력 기준(오늘 0시~, 이번 주 월요일~)이면 월요일 오전·매일 자정 직후에 결과가 거의 비어 보임. 타임존 처리도 단순해짐
   - 관리자 "오늘 수집 글 수"만 Asia/Seoul 자정 기준 (운영 지표라 달력 기준이 자연스러움)
   - 화면 문구가 "오늘/이번 주/이번 달"이면 "24시간/7일/30일"로 바꿀지 판단 요청
2. 닉네임 2~20자, 비밀번호 8~64자(영문·숫자 포함), 소스 수집 주기 30~1440분 상한 추가. 기획서에 상한이 없어 서버가 정함
3. 태그 사전은 추가·수정만 있고 삭제 API 없음 (기획 F-005에 삭제 없음). 필요하면 Next로 요청
4. 관심 태그 PUT은 3~10개 필수. "건너뛰기"는 별도 API로 처리하므로 0개 저장은 허용하지 않음. 설정 화면(S-10)에서 3개 미만으로 줄이는 것도 불가 → 괜찮은지 확인 요청

### 구현 시 서버 내부 사항 (공유용, 검토 불필요)
- 일 배치: 추천 일별 집계 → 추천 노출 90일 삭제, crawl_runs 90일, read_histories 1년, refresh_tokens 만료+7일 삭제. 매시간: post_view_guards 24시간 삭제
- 인기 글·태그 글 수 10분 메모리 캐시
- 재태깅 작업 상태는 서버 메모리 보관 (재시작 시 소실, 003 합의)

## 의견

### server (1차)
- 위 항목 외 명세 전체에 대한 의견도 받음. 왕복 3회 안에 확정하고 M1 구현 착수 예정

### client (1차)
- 변경 10건 모두 수용함. client 반영 내용
  - (1) 쿼리 enum UPPER_SNAKE로 요청함. URL에 보이는 값도 같은 값 사용
  - (2) 로그인·refresh 후 `onboardingCompleted=false`면 S-07로 보냄. 건너뛰기는 `POST /me/onboarding/complete`
  - (3) `AuthResponse.user`를 그대로 써서 앱 시작 시 `GET /me` 생략함
  - (4)(5) 사이드바 태그는 `sort=POST_COUNT`, 소스는 비활성 포함 목록 그대로 씀
  - (9) 무한 스크롤 페이지마다 `recommendationId`를 페이지 데이터에 묶어 보관하고, 카드 클릭 시 그 페이지 ID 전송. `INVALID_CURSOR`면 쿼리 리셋 후 첫 페이지부터 다시 요청
  - (10) `/posts/{id}/views`도 `TOKEN_EXPIRED` 대상이므로 fire-and-forget 대신 공통 래퍼(`keepalive`)로 보내 refresh 후 1회 재시도함. 원문은 새 탭이라 현재 페이지가 살아 있어 재시도 가능
- 명세 보고 client가 맞춘 것 (서버 변경 불필요)
  - `PostSummary.summary` nullable → 카드에서 요약 줄 생략
  - `Tag.category` nullable → 온보딩 분류 탭에서 "기타"로 묶음
  - `tagIds` 최대 10, `sourceIds` 최대 20 → 필터 UI에서 상한 도달 시 추가 선택 비활성 + 안내
- 질문 1건
  - `Me.onboardingCompleted`와 `hasInterestTags`가 모두 있는데 client는 `onboardingCompleted`만 분기에 씀. `hasInterestTags`는 S-02 콜드 스타트 안내 판단용으로 이해했음. 다르면 알려주셈
- pm 확인 항목에 대한 client 의견
  - (1) 롤링 윈도우 찬성. 화면 탭 문구는 "24시간 / 7일 / 30일"로 바꾸는 쪽 제안 (달력 기준으로 오해 방지)
  - (4) 설정에서 3개 미만 불가 괜찮음. 3개일 때 ✕ 버튼 비활성 + "최소 3개 필요" 툴팁으로 처리함

### pm (1차)
- 1. 롤링 윈도우: 승인. 인기 글 화면 문구는 **"24시간 / 7일 / 30일"로 변경** (달력 표현은 오해 소지). 검색 기간 문구 "1주/1개월/1년/전체"는 유지하고 정의만 7/30/365일. 관리자 "오늘 수집"은 Asia/Seoul 자정 기준 승인
- 2. 입력 상한: 닉네임 2~20자, 비밀번호 8~64자, 수집 주기 30~1440분 승인. 명세의 태그 필터 최대 10개·소스 필터 최대 20개, 검색 최대 50페이지도 승인
- 3. 태그 삭제 API 없음: 승인. MVP는 추가·수정만. 운영상 필요해지면 그때 Next로 올림 (삭제 시 기존 글 태그 처리 정책이 함께 필요)
- 4. 관심 태그 3~10개 필수: 승인. 설정 화면에서도 3개 미만으로 줄일 수 없음. 추천은 읽은 기록·북마크·인기 글 보정이 있어 관심 태그를 비울 필요가 낮음
- 001 대비 변경 1~10: 기획 측 이견 없음. 9번 추천 스냅샷 10분 만료는 F-042 수용 기준과 충돌 없음
- 기획서 반영 완료: `02-features.md` v1.2 (F-001, F-005, F-011, F-013, F-021, F-030, F-031), `03-screens.md` S-03 기간 탭 문구, S-10 최소 3개 안내

### server (2차)
- client 반영 내용 확인, 서버 변경 없음
- 질문 답변: 콜드 스타트 판단은 `hasInterestTags`가 아니라 `GET /recommendations` 응답의 `fallback`으로 해야 함
  - 선호도는 관심 태그 + 최근 30일 읽은 글·북마크 태그라, 관심 태그가 없어도 읽은 기록이 있으면 추천이 나옴 (`fallback=false`)
  - `hasInterestTags`는 S-02 헤더에서 관심 태그 칩 영역 대신 "관심 태그 설정" 버튼(S-07 이동)을 보여줄지 판단하는 용도. 추가 호출 없이 분기 가능하게 둔 것임
  - `openapi.yaml` `Me.hasInterestTags`, `RecommendationPage.fallback` 설명에 반영함
- 롤링 윈도우 문구("24시간 / 7일 / 30일")는 pm 결정 따름
- pm 1차 4건 승인 확인. 인기 글 문구 변경은 화면 문구만 바뀌고 API 값(`period=DAY|WEEK|MONTH`)은 그대로라 명세 변경 없음
- server·client 합의 완료 → pm은 결정 기록 후 decided 처리 요청. 이후 `openapi.yaml` v1 확정본 기준으로 M1 구현 착수함

## 결정 (pm)
- 결정 (2026-11-19): OpenAPI 초안 v1 승인
  - 001 대비 변경 1~10: server안 채택 (client 수용)
  - pm 확인 1: 롤링 윈도우 채택. 인기 글 탭 문구 "24시간 / 7일 / 30일", 검색 기간 문구는 유지(7/30/365일 정의). 관리자 "오늘 수집"만 Asia/Seoul 자정 기준
  - pm 확인 2: 닉네임 2~20자, 비밀번호 8~64자, 수집 주기 30~1440분, 태그 필터 10개·소스 필터 20개, 검색 50페이지 상한 채택
  - pm 확인 3: 태그 삭제 API는 MVP 제외
  - pm 확인 4: 관심 태그 3~10개 필수, 설정에서도 3개 미만 불가 (3개일 때 ✕ 비활성 + 안내)
- 근거: server·client·pm 의견 일치, 기획 수용 기준과 충돌 없음, 달력 기준 표현의 오해·빈 결과 문제 제거
- 후속 작업:
  - pm - `02-features.md` v1.2, `03-screens.md` S-03·S-10 반영 (완료)
  - server - client 질문 회신 (완료: 콜드 스타트는 `fallback`, `hasInterestTags`는 S-02 헤더 버튼 분기용, 명세 description 반영). M1 구현 착수
  - client - 명세 기준으로 MSW mock·타입 교체
