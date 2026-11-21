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
