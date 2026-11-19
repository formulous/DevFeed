# 006. 관리자 계정 로그인 시 온보딩 이동 문제

- 상태: decided
- 제기: client
- 관련: server, pm
- 관련 문서: `docs/api/openapi.yaml` (`Me.onboardingCompleted`), `client/src/auth/guards.tsx`, `server/README.md` (`admin:create`)

## 배경
- M1 실서버 확인 중 `admin:create`로 만든 관리자 계정의 로그인 응답이 `onboardingCompleted: false`로 옴
- client는 명세대로 `onboardingCompleted=false`면 로그인 후 `/onboarding/tags?redirect=...`로 보냄
- 결과: 관리자가 `/login?redirect=/admin`으로 로그인해도 온보딩(S-07, M4 전까지 자리표시)으로 감. `/admin`을 직접 열면 들어가짐

## 제안 / 한계점
- 제안 A (client 선호): `admin:create`가 계정을 만들 때 `onboarding_completed_at`을 채움. 관리자 계정은 운영용이라 관심 태그 온보딩 대상이 아님
- 제안 B: client가 `role=ADMIN`이면 온보딩 이동을 건너뜀. 관리자가 일반 기능(추천)도 쓰는 경우 관심 태그가 없는 상태로 남음
- 기존 관리자 계정(id 3)은 A로 가면 server 쪽에서 한 번 갱신 필요

## 의견

### client (1차)
- A 제안. client 코드 변경 없이 명세(`onboardingCompleted`) 의미가 그대로 유지됨
- M1 확인에는 지장 없음 (`/admin` 직접 진입 가능). M1 완료 판정을 막는 이슈는 아님

### pm (1차)
- A 채택. 온보딩(F-031)은 "가입 직후" 일반 회원 흐름이고, 스크립트로 만드는 운영용 관리자 계정은 대상이 아님

### server (1차)
- A 수용, 반영 완료
  - `admin:create`가 새 계정의 `onboarding_completed_at`을 채움. 기존 계정에 다시 실행해도 이미 있는 값은 유지함 (`server/src/scripts/create-admin.ts`)
  - 기존 관리자 계정 2개(id 1, 3)는 `onboarding_completed_at`만 갱신함. 비밀번호는 그대로임
  - `GET /me`에서 `onboardingCompleted: true` 확인
- 명세 변경 없음. pm은 결정란 기록 후 decided 처리 요청

## 결정 (pm)
- 결정 (2026-11-19): 제안 A. `admin:create`가 계정 생성 시 `onboarding_completed_at`을 채움. 기존 관리자 계정(id 3)은 server가 1회 갱신
- 근거: 명세의 `onboardingCompleted` 의미 유지, client 변경 없음. B는 역할별 예외 분기가 늘고 관리자의 일반 기능 사용 시 상태가 애매해짐. 관리자도 관심 태그가 필요하면 S-10에서 설정 가능
- 후속 작업:
  - server - `admin:create` 수정, 기존 관리자 계정 1회 갱신 (완료: id 1·3 갱신, `GET /me` `onboardingCompleted: true` 확인)
  - client - 수정 후 `/login?redirect=/admin` 복귀 확인
