# 027. 패스키 로그인과 로그인 화면 개편

- 상태: open
- 제기: pm (사용자 요청)
- 관련: dba, server, client
- 관련 문서: `docs/spec/02-features.md` F-030·F-034, `docs/spec/03-screens.md` S-05·S-06·S-10·S-11, `docs/spec/04-roadmap.md` M9

## 배경
- 사용자 요청 (2026-11-22): 로그인 방식은 **패스키 + 이메일**로 우선 진행, 로그인 화면 전체 레이아웃은 Linear(linear.app/login)와 비슷한 느낌
- 이메일 = 지금의 이메일+비밀번호 로그인 유지 (pm 해석, 바깥 준비 없는 안). 메일 코드 로그인·비밀번호 찾기·구글 로그인은 Next
- 포트폴리오 어필: WebAuthn 표준 직접 구현(챌린지·서명 검증·서명 횟수 확인), 비밀번호 없는 로그인과 기존 토큰 체계 통합

## 결정 (pm)

### 화면: S-05 로그인 (Linear 느낌, 똑같이 베끼지 않음)
```
 DevFeed                                              ☾
 (서비스 탭·검색·푸터 없음)




                      ◆ (DevFeed 로고 마크)

                   DevFeed에 로그인

              [ 🔑  패스키로 로그인        ]   ← 주 버튼 (채움)
              [ ✉  이메일로 계속하기       ]   ← 보조 버튼 (테두리)

              계정이 없으신가요? 회원가입



                                  개인정보 안내
```
- "이메일로 계속하기"를 누르면 같은 자리에서 이메일·비밀번호 입력칸과 [로그인] 버튼으로 바뀜(부드럽게 전환), 아래에 "← 다른 방법으로 로그인"
```
                   DevFeed에 로그인
              [ 이메일 주소              ]   ← autocomplete="username webauthn"
              [ 비밀번호                 ]
              [ 로그인 ]
              ← 다른 방법으로 로그인
```
- 레이아웃 원칙
  - 화면 정중앙에 폭 320~360px 한 줄 스택. 카드 상자·테두리 없음, 넓은 여백
  - 상단은 왼쪽 로고, 오른쪽 테마 버튼만. 1단 탭·검색·푸터 숨김 (가입·로그인 화면 공통)
  - 배경: 테마 배경색 + 상단 가운데에 아주 옅은 방사형 빛(다크에서만 눈에 띄는 정도, 라이트는 거의 안 보이게). 색은 무채색 계열, 022 토큰 사용
  - 버튼 높이 44px, 모서리 8px, 아이콘 + 글자 가운데 정렬. 입력칸도 같은 높이
  - 들어올 때 살짝 위로 떠오르며 나타남(200ms 안), `prefers-reduced-motion`이면 생략
  - 문구 해요체(024)
- 이메일 입력칸에 브라우저가 저장된 패스키를 제안하면(자동완성) 그걸 골라도 바로 로그인됨
- 브라우저가 패스키를 지원하지 않으면 패스키 버튼을 숨기고 이메일 입력 상태로 바로 보여 줌
- 오류: 입력칸 아래 한 줄. 패스키 취소는 오류로 보이지 않음(조용히 원래 상태), 등록 안 된 패스키는 "이 패스키로 가입된 계정을 찾을 수 없어요"
- 로그인 후 원래 보던 화면으로 돌아감 (기존과 같음)

### 화면: S-06 회원가입
- S-05와 같은 레이아웃. 제목 "DevFeed 계정 만들기", 입력칸 이메일·비밀번호·닉네임 (비밀번호 확인칸은 없애고 비밀번호 보기 버튼으로 대체), [가입하기], "이미 계정이 있으신가요? 로그인"
- 가입 직후 한 단계: "다음부터 지문이나 얼굴로 바로 로그인할까요?" [패스키 만들기] [나중에] → 그 뒤 기존 관심 태그 온보딩(S-07)
  - 패스키 미지원 브라우저면 이 단계 건너뜀

### 화면: S-10 설정에 "패스키" 섹션
```
패스키     [+ 패스키 추가]
  MacBook Chrome · 만든 날 11-22 · 마지막 사용 2시간 전   [이름 바꾸기] [삭제]
  iPhone Safari  · 만든 날 11-22 · 사용 전                [이름 바꾸기] [삭제]
```
- 이름은 처음엔 기기·브라우저로 자동 생성, 바꿀 수 있음(1~40자)
- 삭제는 확인 모달. 패스키를 모두 지워도 이메일 로그인은 남음

### F-034 패스키 로그인 (M9)
- 가입은 지금처럼 이메일+비밀번호로만. 패스키는 로그인한 회원이 추가 (기기를 잃어도 이메일로 들어와 다시 등록 가능)
- 로그인은 이메일 입력 없이(저장된 패스키 목록에서 선택) 가능
- 기준
  - RP ID `formulous.org`, 허용 origin `https://formulous.org` (로컬 개발은 `localhost`)
  - 사용자 확인(지문·얼굴·기기 PIN) 필수
  - 챌린지는 1회용, 5분 만료
  - 서명 횟수가 이전보다 작으면 거부(복제 의심). 단 0을 계속 쓰는 인증기는 허용(표준 동작)
  - 회원당 패스키 최대 10개
  - 성공하면 기존과 같은 액세스·리프레시 토큰 발급 (로그아웃·토큰 갱신 그대로)
  - 패스키 로그인 시도는 기존 로그인 속도 제한(IP)에 포함. 계정 잠금(5회 실패)은 비밀번호 로그인에만 적용
- 탈퇴 시 패스키 전부 삭제, 탈퇴 확인은 지금처럼 비밀번호 재입력 (모든 회원이 비밀번호를 가짐)
- 개인정보 안내(S-11) 문구 추가: "패스키를 쓰면 기기가 만든 공개키만 저장해요. 지문·얼굴 정보는 기기 밖으로 나가지 않아요"

## 수용 기준
- 1280·360 라이트/다크에서 로그인·가입 화면이 위 레이아웃대로 보이고, 탭·검색·푸터가 없음. 가로 넘침 0
- 회원가입 → 패스키 만들기 → 로그아웃 → 패스키로 로그인 → 원래 화면 복귀 (Playwright 가상 인증기로 확인)
- 이메일 입력칸 자동완성으로 패스키 로그인 가능 (지원 브라우저)
- 패스키 미지원 환경: 패스키 버튼·가입 후 단계 숨김, 이메일 로그인 정상
- 재사용한 챌린지, 다른 origin, 서명 횟수 역행 → 거부 (server e2e)
- 설정에서 패스키 추가·이름 바꾸기·삭제, 11번째 추가 거부
- 탈퇴 후 패스키 잔존 0
- 기존 이메일 로그인·잠금·속도 제한 회귀 없음

## 후속 작업
- dba - 패스키 저장 테이블(회원·credential id·공개키·서명 횟수·transports·이름·만든 날·마지막 사용), 탈퇴 대상 추가. 챌린지 저장 위치는 server와 협의
- server - `openapi.yaml`(등록·로그인 옵션 발급·검증, 목록·이름 바꾸기·삭제) → 구현·e2e
- client - S-05·S-06 Linear 느낌 레이아웃 먼저(서버 변경 없이 배포 가능), 패스키 흐름은 mock 선행, 공개 배포는 server 배포 후
- pm - `02-features.md` F-034, `03-screens.md` S-05·S-06·S-10·S-11, `04-roadmap.md` M9 (완료)
- 운영 DB 마이그레이션은 사용자 확인 후 적용

## 의견

### client (1차, 2026-11-22) — 화면 구조와 필요한 API 형태
- 진행 순서
  1. S-05·S-06 레이아웃 개편 먼저 배포 (서버 변경 없음). 패스키 버튼·가입 후 단계·설정 섹션은 **빌드 플래그 `VITE_PASSKEY`** 로 숨김 → `build:web`은 server 배포 전까지 꺼 둠. 꺼져 있으면 로그인 화면은 처음부터 이메일 입력 상태
  2. 패스키 흐름은 mock 선행(dev·테스트에서 켬). server 배포 후 플래그 켜고 재배포
- WebAuthn 처리: `@simplewebauthn/browser` 13 사용 (옵션·응답 JSON ↔ ArrayBuffer 변환, 자동완성(conditional UI) 지원 확인). server가 `@simplewebauthn/server`를 쓰면 옵션·응답 형태가 그대로 맞음. 다른 라이브러리면 **W3C JSON 형태**(`PublicKeyCredentialCreationOptionsJSON`·`RegistrationResponseJSON` 등, base64url)만 지켜 주면 됨
- server에 바라는 형태 (이름·경로는 server 결정 따름)
  | 용도 | 요청 | 응답 |
  |---|---|---|
  | 로그인 옵션 | `POST /auth/passkey/options` (비인증) | `{ challengeId, options }` — `allowCredentials` 비움(계정 선택은 기기에서), `userVerification: required` |
  | 로그인 검증 | `POST /auth/passkey/verify { challengeId, credential }` | 기존 로그인과 같은 `AuthResponse` + 리프레시 쿠키 |
  | 등록 옵션 | `POST /me/passkeys/options` (회원) | `{ challengeId, options }` — `excludeCredentials`에 기존 패스키, `residentKey: required` |
  | 등록 검증 | `POST /me/passkeys { challengeId, credential, name? }` | `201 Passkey` |
  | 목록 | `GET /me/passkeys` | `{ items: Passkey[] }` (최근 만든 순) |
  | 이름 바꾸기 | `PATCH /me/passkeys/{id} { name }` | `200 Passkey` |
  | 삭제 | `DELETE /me/passkeys/{id}` | `204` |
  - `Passkey`: `id`, `name`, `createdAt`, `lastUsedAt|null`
  - `challengeId`로 챌린지를 찾는 방식 제안(쿠키 없이 탭 여러 개에서도 섞이지 않음). 쿠키 방식이어도 client는 상관없음
  - 이름 자동 생성: client가 `name`에 기기·브라우저 이름(예: `Mac Chrome`, `iPhone Safari`)을 넣어 보냄. 없으면 server 기본값("패스키 N")
  - 오류 `code`: `PASSKEY_NOT_FOUND`(등록 안 된 패스키 → "이 패스키로 가입된 계정을 찾을 수 없어요"), `PASSKEY_CHALLENGE_EXPIRED`(5분·재사용), `PASSKEY_VERIFICATION_FAILED`(origin·서명·횟수 역행), `PASSKEY_LIMIT_EXCEEDED`(10개), 속도 제한은 기존 로그인 코드 재사용, `fieldErrors.name`(1~40자)
- 화면 처리
  - 패스키 사용 가능 = 플래그 켬 + `PublicKeyCredential` 존재. 아니면 패스키 버튼·가입 후 단계·설정 섹션 숨김
  - 자동완성: 이메일 입력 상태가 되면 `autocomplete="username webauthn"` + 조건부 요청 시작, 화면을 떠나거나 패스키 버튼을 누르면 취소. 브라우저가 지원하지 않으면 조용히 생략
  - 사용자가 취소(`NotAllowedError`)하면 오류 없이 원래 상태
  - 가입 직후 단계: `/onboarding/passkey` → [패스키 만들기]·[나중에] → 기존 관심 태그 온보딩. 가입 직후에만 보이고 일반 로그인에선 안 보임
  - 탈퇴 확인은 비밀번호 그대로 (변경 없음)

### server (1차) — 구현 방식·챌린지 저장·API 초안
**1. 검증 라이브러리 (pm 확인 필요)**
- 권장: `@simplewebauthn/server`로 CBOR·COSE 파싱과 서명 검증만 맡기고, 나머지(챌린지 발급·1회 소비·만료, origin/RP ID 고정, 사용자 확인 강제, 서명 횟수 역행 거부, 개수 제한, 토큰 발급 통합)는 server가 직접 구현
  - 근거: 암호 파싱을 손으로 짜면 경계 버그가 보안 구멍이 됨. 포트폴리오 어필 지점(챌린지·서명 횟수·토큰 통합)은 그대로 server 코드에 남음
- 대안: attestation `none`만 받고 node `crypto` + 자체 CBOR 디코더로 ES256·RS256만 지원하는 완전 직접 구현. 300줄 안팎 추가, 알고리즘 범위가 좁아짐
- pm 결정 전까지 명세 작업은 영향 없음(API 형태 동일)

**2. 챌린지 저장 → DB 테이블 제안 (dba)**
- 메모리 저장은 재시작 시 사라지고 1회 소비 원자성을 직접 챙겨야 함. DB면 `DELETE ... WHERE challenge_hash = ? AND expires_at > ?` 영향 행 1일 때만 통과 → 재사용 차단이 한 문장으로 끝남
- `webauthn_challenges` 제안
  - `challenge_hash` BINARY(32) PK (sha256, 원문 저장 안 함)
  - `purpose` ENUM('REGISTER','LOGIN')
  - `user_id` BIGINT UNSIGNED NULL (REGISTER만, FK CASCADE)
  - `expires_at` DATETIME(3), 인덱스 (만료 정리용)
  - `created_at`
- 정리: 발급 시 만료 행 소량 삭제(`LIMIT 100`) → 별도 스케줄러 불필요
- 로그인 챌린지는 비회원 발급이라 IP 속도 제한 필수 (아래 4)

**3. 패스키 테이블 컬럼 의견 (dba)**
- `credential_id` VARBINARY(1023) UNIQUE (표준 최대 1023바이트)
- `public_key` VARBINARY(1024) (COSE 키, RSA 포함 여유)
- `sign_count` INT UNSIGNED NOT NULL DEFAULT 0
- `transports` VARCHAR(100) NULL (쉼표 구분, 다음 로그인·제외 목록 힌트)
- `name` VARCHAR(40), `created_at`, `last_used_at` NULL
- `user_id` 인덱스(목록·개수 확인), 탈퇴 대상 추가
- 선택: `backed_up` BOOLEAN (동기화 패스키 여부, 화면 표시 안 하면 생략 가능)
- user handle은 별도 컬럼 없이 `users.id` 문자열의 바이트로 씀(개인정보 아님). 로그인은 credential id로 찾고 userHandle 일치만 확인

**4. API 초안 (명세는 dba 스키마 확정 후 작성)**
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/passkeys/login/options` | 없음 | 로그인 옵션(challenge, rpId, timeout 300000, userVerification `required`, allowCredentials 빈 배열) |
| POST | `/auth/passkeys/login` | 없음 | 응답 검증 → `/auth/login`과 같은 본문 + 리프레시 쿠키 |
| POST | `/me/passkeys/registration/options` | 회원 | 등록 옵션(excludeCredentials = 기존 패스키, residentKey `required`, attestation `none`) |
| POST | `/me/passkeys` | 회원 | 등록 검증 → 201 Passkey. `name` 생략 시 User-Agent로 "MacBook Chrome" 식 자동 생성 |
| GET | `/me/passkeys` | 회원 | 목록 (만든 순) |
| PATCH | `/me/passkeys/{passkeyId}` | 회원 | 이름 변경 1~40자 |
| DELETE | `/me/passkeys/{passkeyId}` | 회원 | 204 |
- `Passkey`: `id`, `name`, `createdAt`, `lastUsedAt`(nullable)
- 옵션 응답은 브라우저 `PublicKeyCredential.parse*OptionsFromJSON` / simplewebauthn browser가 그대로 받는 JSON 형태(base64url)
- 오류 코드 (메시지 해요체)
  - `PASSKEY_NOT_FOUND` 401 "이 패스키로 가입된 계정을 찾을 수 없어요"
  - `PASSKEY_VERIFICATION_FAILED` 401 "패스키를 확인하지 못했어요. 다시 시도해 주세요" (챌린지 재사용·만료, origin 불일치, 서명 실패, 서명 횟수 역행 모두 같은 응답. 원인은 로그로만)
  - `PASSKEY_LIMIT_EXCEEDED` 409 "패스키는 10개까지 만들 수 있어요"
  - `PASSKEY_ALREADY_REGISTERED` 409 "이미 등록된 패스키예요"
- 속도 제한: 로그인 옵션·검증 두 경로 모두 기존 `login`과 같은 한도(IP당 분당 10). 버킷은 경로별(기존 throttler 구조). 한 버킷 공유가 필요하면 pm 의견 바람
- 동시성
  - 서명 횟수: `UPDATE ... SET sign_count = ?, last_used_at = ? WHERE id = ? AND (sign_count < ? OR (sign_count = 0 AND ? = 0))` 영향 행 0이면 거부 → 같은 응답 동시 제출도 한쪽만 통과
  - 10개 제한: 등록 시 `users` 행 `FOR UPDATE` 후 개수 확인
- 설정: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGINS`(쉼표 구분) 키를 `.env.example`에 추가. 운영 값(`formulous.org`, `https://formulous.org`)은 사용자에게 `.env` 반영 요청 예정
- 진행 순서: dba 스키마 → server 명세 → client 대조 → 구현·e2e(가상 인증기 대신 테스트에서 키쌍으로 응답 직접 서명해 재사용·origin·횟수 역행 거부 확인)

### pm (결정, 2026-11-22)
- **검증 라이브러리: `@simplewebauthn/server` 사용** (server 권장안). CBOR·COSE 파싱과 서명 검증은 검증된 라이브러리에 맡기고, 챌린지 1회 소비·만료, origin·RP ID 고정, 사용자 확인 강제, 서명 횟수 역행 거부, 개수 제한, 토큰 통합은 server 코드로 구현. 자체 암호 파싱은 보안 위험 대비 어필 이득이 작음. client `@simplewebauthn/browser`와 형태가 그대로 맞음
- 챌린지 저장: DB `webauthn_challenges`(sha256 해시, 1회 `DELETE` 소비) 승인 → dba
- 패스키 테이블: server 3번 컬럼안 승인. `backed_up`은 저장만 하고 화면 표시는 안 함 (Next에서 "동기화됨" 표시 후보)
- API 경로·형태: **server 초안 기준**(명세 소유). client 제안의 `challengeId`는 불필요(server가 응답 안 챌린지 해시로 찾음) → client가 server 경로에 맞춤
- 오류: 만료·재사용·origin·서명·횟수 역행을 `PASSKEY_VERIFICATION_FAILED` 하나로 묶는 것 승인 (원인 노출 안 함). client 제안 `PASSKEY_CHALLENGE_EXPIRED`는 두지 않음
- 속도 제한: 경로별 버킷, IP당 분당 10 승인
- 이름: client가 기기·브라우저 이름을 보내고, 없으면 server가 User-Agent로 생성
- client `VITE_PASSKEY` 플래그 방식 승인: 레이아웃 개편 먼저 배포, 패스키 UI는 server 배포 후 플래그 켜고 재배포
- 운영 `.env`의 `WEBAUTHN_RP_ID`·`WEBAUTHN_RP_NAME`·`WEBAUTHN_ORIGINS`는 사용자가 직접 넣음 (server가 키 이름·값 안내)
- 다음: dba 스키마 → server 명세 → client 대조 → 구현

### server (2차) — client 1차와 맞춤 (server 1차 API 초안을 이 내용으로 대체)
- client 1차와 server 1차가 동시에 작성됨. client 제안을 대부분 수용해 아래로 확정 예정 (명세에 그대로 반영)
- 수용
  - 경로·형태: client 표 그대로 (`/auth/passkey/options`, `/auth/passkey/verify`, `/me/passkeys/options`, `/me/passkeys`, 목록 `{ items }` 최근 만든 순, PATCH 200 Passkey)
  - `challengeId` 방식: 옵션 응답 `{ challengeId, options }`, 검증 요청 `{ challengeId, credential }`. `options`·`credential`은 W3C JSON(base64url), `@simplewebauthn/browser` 13과 그대로 맞음
  - 이름: client가 `name` 전송, 없으면 server 기본값 "패스키 N" (server User-Agent 해석은 하지 않음)
  - 오류 코드 분리: `PASSKEY_CHALLENGE_EXPIRED`(만료·재사용·없는 challengeId) 별도, `PASSKEY_VERIFICATION_FAILED`(origin·RP ID·서명·사용자 확인 없음·횟수 역행), `PASSKEY_NOT_FOUND`, `PASSKEY_LIMIT_EXCEEDED`, `PASSKEY_ALREADY_REGISTERED`(등록 시 같은 credential id), 속도 제한은 기존 `RATE_LIMITED`
  - 둘 다 401/409 구분은 server 1차 그대로, `PASSKEY_CHALLENGE_EXPIRED`는 400
- dba 챌린지 테이블 수정 (challengeId 방식 반영)
  - `id` BINARY(16) PK (랜덤, 응답에 base64url로 나감), `challenge` BINARY(32), `purpose`, `user_id` NULL FK CASCADE, `expires_at` 인덱스, `created_at`
  - 소비: `DELETE FROM webauthn_challenges WHERE id = ? AND purpose = ? AND expires_at > ? RETURNING challenge, user_id` 한 문장 (MariaDB 지원) → 행이 없으면 `PASSKEY_CHALLENGE_EXPIRED`. 등록은 `user_id`가 요청 회원과 같은지 추가 확인
  - 검증 실패해도 챌린지는 이미 지워져 재시도 시 옵션부터 다시 받음 (client는 실패 시 옵션 재요청)
- pm 결정 대기: 검증 라이브러리 사용 여부(server 1차 1번). 결정과 dba 스키마가 나오면 명세 작성

### server (3차) — pm 결정 따름, server 2차 철회
- pm 결정이 server 2차보다 먼저 기록돼 있음. **server 2차는 철회하고 pm 결정(= server 1차 기준)으로 진행**
  - 경로: `/auth/passkeys/login/options`, `/auth/passkeys/login`, `/me/passkeys/registration/options`, `/me/passkeys`, `/me/passkeys/{passkeyId}`
  - `challengeId` 없음: server가 `clientDataJSON.challenge`의 sha256으로 챌린지 행을 찾아 `DELETE`로 1회 소비
  - 오류: 만료·재사용·origin·서명·횟수 역행 모두 `PASSKEY_VERIFICATION_FAILED`. `PASSKEY_CHALLENGE_EXPIRED` 없음
  - 이름: client 전송 우선, 없으면 server가 User-Agent로 생성
- client 1차에서 그대로 쓰는 것: 옵션·응답은 W3C JSON(`@simplewebauthn/browser` 13 형태), 목록 `{ items }` 최근 만든 순, PATCH 200 Passkey, `fieldErrors.name`
  - 옵션 응답은 `options` 객체를 감싸지 않고 본문 그대로, 검증 요청은 `{ credential, name? }`(등록) / `{ credential }`(로그인)
- dba 챌린지 테이블은 server 1차안(`challenge_hash` PK) 그대로
- 다음: dba 스키마 나오면 명세 작성 후 client·pm 대조 요청

### dba (1차) — 스키마 `0013` (pm 결정·server 3차 기준)
- `db/migrations/0013_create_passkeys.sql`, 쿼리 예시 `db/queries/passkeys.sql`
  | 대상 | 내용 |
  |---|---|
  | `webauthn_challenges` | server 1차안 그대로: `challenge_hash BINARY(32)` PK, `purpose`, `user_id` NULL FK CASCADE(CHECK: REGISTER만 필수), `expires_at` 인덱스, `created_at` |
  | `user_passkeys` | `credential_id VARBINARY(1023)` UK(16바이트 이상 CHECK), `public_key VARBINARY(2048)`, `sign_count INT UNSIGNED`, `transports VARCHAR(255)`, `aaguid BINARY(16)`, `backup_eligible`·`backup_state` BOOLEAN, `name VARCHAR(40)`(공백 아닌 1자 이상 CHECK), `created_at`·`last_used_at`·`updated_at`, `(user_id, created_at)` 인덱스, FK CASCADE |
  | `users` | `webauthn_handle BINARY(32) NULL UNIQUE` |
- server 3번과 다른 점
  - **user handle은 `users.id` 대신 `users.webauthn_handle` 랜덤 32바이트** 권장: 표준이 식별 정보 없는 랜덤값을 권장하고, 순번 id면 인증기(동기화되는 비밀번호 관리자 포함)에 가입 순서·회원 수가 남음. 첫 등록 트랜잭션에서 `NULL`이면 채우고 이후 고정. 로그인은 credential id로 찾고 userHandle이 이 값과 같은지만 확인. server가 `users.id` 방식을 꼭 원하면 의견 주기 바람 (컬럼만 비워 두면 됨)
  - `backed_up` 대신 `backup_eligible`·`backup_state` 두 플래그 (등록 응답의 BE·BS 그대로). 화면 표시는 안 함 (pm 결정과 같음)
  - `public_key` 2048, `transports` 255로 여유 (가변 길이라 저장 비용 같음)
- 동작 규칙 (`passkeys.sql`): 챌린지 소비 `DELETE ... WHERE challenge_hash = ? AND purpose = ? AND expires_at > now` 영향 행 1 / 발급 때 만료 행 100개 정리 / 서명 횟수 `WHERE (? > sign_count OR (? = 0 AND sign_count = 0))` 영향 행 0이면 거부 / 등록은 `users` 행 `FOR UPDATE` → 개수 확인 → 삽입
- 탈퇴: 두 테이블 FK CASCADE (파생 카운터 없음). `withdrawal-check.sql`에 `user_passkeys`·`webauthn_challenges` 추가 → server e2e 잔존 검사 11개 테이블
- 검증 (`devfeed_test`·`devfeed_perf` up → down → up 통과)
  - 챌린지: 첫 소비 1, 재사용 0, 만료 0. REGISTER인데 회원 없음 → CHECK 거부
  - 패스키: 같은 credential 재등록 1062(→ `PASSKEY_ALREADY_REGISTERED`), 이름 공백·41자 거부, credential 8바이트 거부. 서명 횟수 역행 영향 0·증가 1. credential 조회 `const`
- 운영 `devfeed` 적용은 사용자 확인 후 (적용해도 현재 서버 영향 없음: nullable 컬럼 1개·새 테이블 2개)

### server (명세 반영) — `openapi.yaml`·`conventions.md`
- dba 0013 수용. user handle은 `users.webauthn_handle` 랜덤 32바이트 사용
  - 등록 옵션의 `user.id`가 패스키 생성 전에 정해져야 해서, 채우는 시점은 첫 등록 저장이 아니라 **첫 등록 옵션 발급**(`UPDATE ... WHERE webauthn_handle IS NULL` 후 다시 읽음). 스키마 변경 없음
  - `backup_eligible`·`backup_state`·`aaguid`는 저장만, 응답에 넣지 않음
- 경로 (pm 결정·server 3차 그대로)
  | 메서드 | 경로 | 응답 |
  |---|---|---|
  | POST | `/auth/passkeys/login/options` | 200 `PasskeyRequestOptions` (W3C JSON 본문 그대로) |
  | POST | `/auth/passkeys/login` `{ credential }` | 200 `AuthResponse` + 리프레시 쿠키 |
  | POST | `/me/passkeys/registration/options` | 200 `PasskeyCreationOptions`, 이미 10개면 409 |
  | GET | `/me/passkeys` | 200 `{ items: Passkey[] }` 최근 만든 순 |
  | POST | `/me/passkeys` `{ credential, name? }` | 201 `Passkey` |
  | PATCH | `/me/passkeys/{passkeyId}` `{ name }` | 200 `Passkey` |
  | DELETE | `/me/passkeys/{passkeyId}` | 204, 남의 것·없는 것 404 |
- 오류: `PASSKEY_NOT_FOUND` 401, `PASSKEY_VERIFICATION_FAILED` 로그인 401·등록 400, `PASSKEY_LIMIT_EXCEEDED` 409, `PASSKEY_ALREADY_REGISTERED` 409, 이름은 `VALIDATION_FAILED` + `fieldErrors.name`
- 챌린지는 검증 실패여도 소비됨 → client는 실패 후 재시도 시 옵션부터 다시 요청
- 패스키 로그인 성공은 `last_login_at`만 갱신하고 비밀번호 잠금 상태(`failed_login_count`·`locked_until`)는 건드리지 않음
- 다음: client·pm 대조 후 구현

### dba (2차) — server 수용 확인
- `webauthn_handle`을 등록 옵션 발급 때 채우는 방식 동의 (옵션의 `user.id`에 바로 필요). `UPDATE ... WHERE webauthn_handle IS NULL`이라 동시 발급에도 한 값으로 고정됨 → 채운 뒤 다시 읽어서 쓰기 바람. `passkeys.sql`·tables·decisions 반영
- 남은 것: 운영 `devfeed` `0013` 적용 사용자 확인

### client (2차, 2026-11-22) — 명세 대조, 화면 개편 배포, 패스키 mock 구현
- 명세(`openapi.yaml` 패스키 7개 경로) 대조: client 구현과 **차이 없음**. pm 결정·server 3차대로 `challengeId` 없음, 옵션은 본문 그대로, 검증 `{ credential }`·등록 `{ credential, name }`, 오류 `PASSKEY_NOT_FOUND`·`PASSKEY_VERIFICATION_FAILED`(로그인 401·등록 400)·`PASSKEY_LIMIT_EXCEEDED`(옵션·등록 409)·`PASSKEY_ALREADY_REGISTERED`, 이름 `fieldErrors.name`. 실패 후 재시도는 매번 옵션부터 요청함
- S-05·S-06 개편 **배포함** (`VITE_PASSKEY=false`): 로고·테마 버튼만 있는 상단, 가운데 340px 스택, 카드 없음, 상단 방사형 빛, 44px 버튼·입력칸(모서리 8px), 떠오르는 등장(동작 줄이기 설정 시 없음). 가입은 비밀번호 확인칸 대신 보기 버튼. 패스키 꺼진 지금은 로그인이 이메일 입력부터 보임
  - 실서버 확인(1280 다크·360 라이트): 패스키 버튼 0, 탭·검색·푸터 0, 가로 넘침 0, 확인칸 0, 개인정보 "패스키" 항목 숨김, 페이지 오류 0
- 패스키 흐름(mock, dev·테스트에서 켬): 로그인 [패스키로 로그인]·[이메일로 계속하기]↔"다른 방법으로 로그인", 이메일 입력 상태 자동완성(조건부 요청), 취소는 조용히, 가입 직후 `/onboarding/passkey` → 관심 태그, 설정 패스키 섹션(추가·이름 바꾸기·삭제·10개 제한), 개인정보 문구(지정 문구 + 보관 항목)
  - 이름 자동 생성은 client가 `name`으로 보냄 (`Mac Chrome`·`iPhone Safari`·`Windows Edge` 식)
- 검증: 테스트 150건 통과 (`passkey.test.tsx` 12건). 캡처 16화면×3폭 라이트·다크 가로 넘침 0. **Playwright CDP 가상 인증기**(실제 Chrome WebAuthn, mock 서버)로 가입 → 패스키 만들기(resident key 생성 확인) → 로그아웃 → 패스키 로그인 → `redirect` 복귀·설정에 "마지막 사용 방금 전" 확인
- server 배포 후: `VITE_PASSKEY` 빼고 재배포 → 실서버에서 가상 인증기로 같은 흐름 확인 (실서버 RP ID가 `formulous.org`라 가상 인증기 확인은 formulous.org 페이지에서 진행)

### pm (dba 1차 검토, 2026-11-22)
- `0013` 승인. user handle은 dba안(**`users.webauthn_handle` 랜덤 32바이트**) 채택: 표준 권장이고 순번 id가 인증기에 남지 않음 → server는 이 값 사용
- `backup_eligible`·`backup_state` 저장, 화면 표시 없음 (pm 결정과 같음)
- **사용자 승인 (2026-11-22)**: 운영 `devfeed`에 `0013` 적용 진행 → dba 적용
- 다음: server 명세·구현

### dba (3차) — 운영 `devfeed`에 `0013` 적용 완료 (2026-11-22)
- 사용자 승인에 따라 적용. 회원 3·리프레시 토큰 71·글 2,610·댓글 1·좋아요 2 전후 동일, `webauthn_handle` 전부 NULL
- `user_passkeys`·`webauthn_challenges` 생성 확인. 실행 중인 서버 health·피드 200, 잘못된 로그인 401 (기존 로그인 동작 유지)
- dba 027 작업 끝. server 배포 후 탈퇴 잔존 검사(11개 테이블) 결과 공유 부탁

### server (구현·배포) — `c8ce641`
- 명세대로 구현, :3000 배포. 운영 DB `0013` 적용 확인
- 검증: 단위 141건, e2e 61건 통과 (`passkeys.e2e-spec.ts` 8건 추가, 탈퇴 잔존 11개 테이블)
  - P-256 가상 인증기로 응답을 직접 서명: 등록 → 로그아웃 → 패스키 로그인 → 리프레시, 재사용 챌린지·다른 origin·다른 RP ID·사용자 확인 없음·서명 횟수 역행·userHandle 불일치 거부, 0을 계속 쓰는 인증기 허용, 같은 응답 5개 동시 제출 1건만 성공, 11번째 409, 잠금 중 패스키 로그인 가능, 탈퇴 후 잔존 0
- **남은 것: 운영 `server/.env`에 RP 설정 필요 (사용자)**. 지금은 기본값 `rpId: localhost`라 운영 패스키 동작 안 함
  - `WEBAUTHN_RP_ID=formulous.org`, `WEBAUTHN_RP_NAME=DevFeed`, `WEBAUTHN_ORIGINS=https://formulous.org`
  - 설정 후 server가 재시작·옵션 응답 `rpId` 확인한 뒤 client에 플래그 켜도 된다고 알림
