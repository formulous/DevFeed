# 014. M6 출시·성능 리포트 계획

- 상태: open
- 제기: pm
- 관련: server, client, dba
- 관련 문서: `docs/spec/04-roadmap.md` M6, `docs/spec/02-features.md` 비기능 요구사항, `docs/discussions/009`, `010`, `013`

## 배경
- M1~M5 완료 (MVP 기능 전부 구현·실서버 확인)
- M6 완료 기준: 배포, 부하 측정 결과와 설계 결정 문서를 README에 정리
- 현재 실행 환경: 맥미니 로컬 `:3000` 서버(수동 실행), `https://formulous.org/portfolio/` 확인 환경(nginx 기본 인증, `noindex`, 009)

## 역할별 작업

### server
1. 운영 실행: 서버가 재부팅·종료 후 자동으로 다시 뜨도록 실행 방식 정리 (기존 formulous 운영 방식 참고, `~/workspace/README.md`). 프로덕션 빌드(`npm run build` → `node dist/main`) 기준
2. 보안 점검표: 비기능 요구사항 대조 (비밀번호 해시, 관리자 권한 분리, 로그인 잠금, 쿠키 속성, 에러 응답에 내부 정보 미노출, 요청 크기·속도 제한 여부)
3. 성능 리포트 원자료: 피드(007)·검색(010)·추천(013) 측정표를 같은 형식으로 `server/README.md`에 정리. 검색 923 → 301 → 94ms 개선 과정 포함

### dba
1. 버퍼 풀 재검토 (010 보류 건): 512MB 적용 여부 판단, 적용 시 컨테이너 재시작은 사용자 승인. 적용하면 검색·추천 재측정
2. 백업: `devfeed` 일일 백업 방법과 보관 기간, 복원 절차 1회 검증
3. 스키마 최종 문서: `docs/schema/decisions.md` D-01~D-14 정리 상태 확인

### client
1. 반응형 점검: 360px·768px·데스크톱에서 S-01~S-10, A-01~A-04 깨짐 확인
2. 프로덕션 빌드에 mock 코드가 실행되지 않는지 확인 (`mockServiceWorker.js` 포함 여부 포함)
3. 화면 캡처: README용 주요 화면 캡처 경로 정리 (S-01, S-02, S-04, A-01)

### pm
1. 루트 `README.md` 포트폴리오 요약 초안: 서비스 소개, 아키텍처, 기술 도전 3가지(수집 파이프라인, 한글 검색 성능, 추천), 측정 수치, 설계 결정 링크
   - 루트 `README.md`는 "진행 현황" 외 수정에 사용자 승인 필요 → 초안은 `docs/spec/05-portfolio-summary.md`에 작성하고 사용자 승인 후 반영
2. 기획서 대비 최종 수용 기준 점검표 (`docs/spec/06-acceptance-checklist.md`)

## 사용자 결정 필요
- 공개 범위: 기본 인증을 풀고 공개(이력서 링크용)할지, 기본 인증 유지할지
  - 공개 시: `noindex` 해제 여부, 관리자 API 외부 노출 범위 재검토 필요

## 의견

### client (1차)
- 현재 상태 확인 (11-19)
  - 프로덕션 번들(`dist-web/assets/*.js`)에 `msw`·`setupWorker` 문자열 0건. mock 시작 코드는 `import.meta.env.DEV`일 때만 동적 import라 번들에서 빠짐
  - 다만 `public/mockServiceWorker.js`가 `dist-web/`에 그대로 복사됨. 등록하는 코드가 없어 실행되지는 않지만 불필요한 파일이 공개 경로에 남음
  - 전역 에러 화면(ErrorBoundary)이 없음. 렌더링 오류나 재배포 직후 관리자 청크(lazy) 로드 실패 시 빈 화면이 됨
  - 화면별 `<title>`이 모두 "DevFeed"로 같음
  - 이 세션에는 브라우저 도구가 없어 화면을 직접 볼 수 없음 → 1·3번은 도구가 필요함
- 계획
  1. 반응형 점검·3. 화면 캡처를 한 번에 처리: Playwright로 `360 / 768 / 1280px` × 주요 화면 스크린샷을 찍는 스크립트(`npm run capture`)를 둠
     - 데이터: 기본은 dev 서버 + MSW mock (결정적 화면, 개인정보 없음). 옵션으로 실서버(`VITE_API_MOCK=false`) 캡처
     - 결과: 반응형 점검용은 `client/screenshots/`(git 제외), README용 4장(S-01·S-02·S-04·A-01, 1280px)은 `client/docs/screens/`에 커밋 → pm이 요약 문서에서 링크
     - 깨짐은 스크린샷으로 확인하고 고친 뒤 다시 캡처. 점검 결과는 `client/README.md`에 화면×폭 표로 기록
     - **사용자 승인 필요**: Playwright devDependency 추가와 Chromium 브라우저 다운로드(약 150MB)
  2. 프로덕션 빌드 mock 차단: `vite build` 결과에서 `mockServiceWorker.js`를 빼도록 설정하고, 빌드 후 `msw` 문자열·워커 파일이 없는지 확인하는 테스트(또는 `build` 스크립트 후검사) 추가
  - 추가 제안 (출시 품질, client 범위)
    - 전역 ErrorBoundary: 오류 화면 + 새로고침 버튼, 청크 로드 실패면 1회 자동 새로고침
    - 화면별 `<title>` (예: "검색: 카프카 · DevFeed")
    - 공개로 결정되면: `meta description`·OG 태그·favicon 추가. `noindex`는 nginx 헤더(pm)라 client 변경 없음
- 이견: 없음. 다만 1·3번은 위 승인이 없으면 사용자가 formulous에서 직접 확인·캡처해야 함 (그 경우 client는 점검 체크리스트만 제공)

### dba (1차) — 계획
#### 1. 버퍼 풀: **증설하지 않고 128MB 유지** 제안
- 실측 크기: `devfeed` 6MB (글 2,383건). 버퍼 풀 128MB 안에 전부 들어가 증설 효과 없음
- 10만 건(`devfeed_perf` 834MB)에서도 128MB로 검색 c=1 p95 94ms, 추천 18.6ms로 목표 충족 (010, 013)
- 증설하면 컨테이너 재시작이 필요하고, 같은 컨테이너의 다른 프로젝트 DB(`floa` 467MB)에도 영향이 감. 측정 수치만 좋아지고 실서비스 이득이 없음
- 리포트에는 "버퍼 풀 128MB(기본값) 조건에서 측정"을 명시. 글이 수만 건 이상으로 늘면 재검토 (기준: `posts`+`post_search` 크기가 버퍼 풀의 70% 초과)
- 참고: `db/conf/devfeed.cnf`는 `docker cp`로 넣은 상태라 컨테이너를 새로 만들면 사라짐 (데이터 볼륨은 유지). 운영 정리 시 conf 디렉터리 마운트로 바꾸길 권장 (사용자 작업)

#### 2. 백업
- `db/scripts/backup.sh`: `mariadb-dump --single-transaction --hex-blob --routines --triggers devfeed | gzip` → 저장소 밖 디렉터리(기본 `~/backups/devfeed`), 파일명에 UTC 시각, **14일 보관** 후 자동 삭제
  - `--single-transaction`: InnoDB 잠금 없이 일관된 스냅샷 (수집 중에도 가능)
  - `--hex-blob`: `url_hash`, `token_hash` 등 `BINARY` 컬럼 안전 보관
- `db/scripts/restore.sh`: 지정한 DB로 복원. 대상이 `devfeed`면 확인 플래그 없이는 거부
- 복원 검증 1회: 임시 DB `devfeed_restore_check`에 복원 → 테이블별 행 수, 생성 컬럼(`url_hash` 등) 값, FULLTEXT 검색 결과를 원본과 비교 → 임시 DB 삭제. 결과는 이 문서에 기록
- 일일 실행: 맥미니 `launchd`(또는 crontab)에 등록. 호스트 설정이라 사용자 승인 후 등록
- 개인정보: 백업에 회원 이메일·비밀번호 해시가 포함됨 → 탈퇴 회원 데이터가 백업에 최대 14일 남음. 개인정보 안내 문구에 반영 필요 (pm 확인)

#### 3. 스키마 최종 문서
- `decisions.md` D-01~D-16 상태 점검: "초안", "결정(안)" 표기를 확정 상태로 정리, 기각안과 측정 근거 링크 확인
- `erd.md`·`tables.md` 마이그레이션 0001~0009와 일치 여부를 실제 `devfeed` 스키마와 대조
- 리포트용 요약: 스키마 설계 결정 중 포트폴리오에 쓸 핵심 3가지(앱 bigram FULLTEXT, 커서 인덱스 비정규화, 커버링 인덱스로 검색 923→94ms) 정리해 pm 초안에 링크 제공

### server (1차) — 계획·점검 결과·이견
#### 1. 운영 실행 (자동 재시작)
- 현재: 이 Claude 세션의 백그라운드 작업으로 `node dist/main`을 띄운 상태라 세션이 끝나면 서버도 꺼짐. 재부팅 후 자동 시작 없음
- 제안: macOS `launchd` 사용자 에이전트 (`~/Library/LaunchAgents/org.formulous.portfolio-server.plist`)
  - `RunAtLoad` + `KeepAlive`(비정상 종료 시 재시작), 작업 디렉터리 `server/`, `node dist/main`, 로그는 `server/logs/`(gitignore)
  - korail_macro처럼 tmux 재시작 루프도 가능하지만 재부팅 시 자동 시작이 안 됨. launchd는 로그인 시 자동 시작·크래시 재시작을 둘 다 처리함
  - 서버는 `server/deploy/`에 plist 템플릿과 설치·제거 스크립트(`install.sh`, `uninstall.sh`)만 둠. `~/Library` 설치·`launchctl` 실행은 쓰기 경로 밖이라 사용자 승인 후 사용자가 실행 (또는 승인 시 server가 실행)
  - 배포 순서 문서화: `git pull` → `npm ci` → `npm run build` → `launchctl kickstart -k`로 재시작
- 이견: nginx도 재부팅 시 자동 시작이 안 됨(`~/workspace/README.md`). 서버만 자동화하면 외부 접속은 여전히 수동 → nginx 자동 시작은 pm이 사용자에게 함께 확인 요청 바람 (server 범위 밖)

#### 2. 보안 점검표 (현재 상태, 코드 확인)
| 항목 | 상태 | 근거·조치 |
|---|---|---|
| 비밀번호 해시 | 충족 | bcrypt 12라운드, 없는 계정도 같은 비용으로 비교(시간 차 노출 방지) |
| 관리자 권한 분리 | 충족 | `/api/admin/**` 전부 JWT + `ADMIN` 역할 가드, e2e·실서버 403 확인 |
| 로그인 잠금 | 충족 | 5회 실패 10분 잠금, 423 + `Retry-After` (e2e) |
| 쿠키 속성 | 충족 | 리프레시 `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`(nginx가 `/portfolio/api/`로 변환), 비회원 `df_vid` `HttpOnly; SameSite=Lax; Secure` |
| 토큰 | 충족 | 액세스 15분, 리프레시 회전·재사용 탐지(계열 폐기), DB에는 해시만 저장 |
| 에러 내부 정보 | 충족 | 500은 `INTERNAL_ERROR` 고정 문구, 스택은 서버 로그만. 알 수 없는 경로·메서드도 공통 형식 |
| 요청 크기 | 충족 | JSON 본문 100kb, 피드 수집 응답 20MB |
| 입력 검증 | 충족 | 전 DTO 화이트리스트(모르는 필드 400), 검색 FULLTEXT 질의는 토큰만 남겨 연산자 주입 불가, SQL은 전부 바인딩 |
| **요청 속도 제한** | **미구현** | 로그인 잠금 외 제한 없음 → 가입·로그인·리프레시·조회 기록·검색에 IP 기준 제한 추가 제안 (`@nestjs/throttler`, 429 `RATE_LIMITED`는 conventions에 이미 정의) |
| **실제 클라이언트 IP** | **미설정** | Cloudflare → nginx → 서버 구조라 지금은 모든 요청이 127.0.0.1로 보임. 속도 제한 전에 `trust proxy`(loopback)와 nginx `X-Forwarded-For`/`CF-Connecting-IP` 전달 확인 필요 (nginx는 pm 관리) |
| 보안 헤더 | 일부 | API는 JSON만 응답. `X-Powered-By` 제거함. `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`(인증·내 정보 응답) 추가 제안 |
| 관리자 계정 생성 | 충족 | 스크립트로만 생성(`admin:create`), 가입 API로는 `USER`만 |
| 헬스 체크 | 없음 | launchd·외부 모니터링용 `GET /api/health`(DB 연결 확인) 추가 제안 → openapi에 먼저 추가 |

#### 3. 성능 리포트 원자료
- `server/README.md`에 "성능 리포트" 절을 새로 만들고 같은 형식(데이터 규모, 동시성, p50/p95, 측정 방법, 원자료 위치)으로 정리
  - 수집(M1): 36곳 20초, 중복 0, 데드락 수정 전후
  - 피드(M2·007): 커서 정확성, API p95 2.5ms(2,383건), dba 10만 건 DB p95 최대 6.2ms
  - 검색(M3·010): 923 → 301 → 94ms 단계별 원인·조치, LIKE 기준선 비교, c=10 참고치
  - 추천(M5·013): 첫 페이지 p95 18.6ms, 다음 페이지 5.9ms
- dba가 버퍼 풀 512MB를 적용하면 검색·추천을 같은 스크립트로 재측정해 전후를 같이 남김
- 측정 스크립트를 지금은 scratchpad에서 돌렸음 → `server/scripts/perf/`로 옮겨 재현 가능하게 함 (측정 DB `devfeed_perf` 고정 확인 포함)

#### 4. 공개 범위 (사용자 결정 사항에 대한 server 의견)
- 공개한다면 **2번의 속도 제한·실제 IP 처리를 먼저 반영한 뒤** 기본 인증을 푸는 순서를 권장함. 지금은 가입·로그인·조회 기록에 무제한 요청이 가능함
- 관리자 API는 JWT 역할 검사로 막혀 있어 공개해도 노출 범위는 같음. 추가로 nginx에서 `/portfolio/api/admin/`을 특정 IP로 제한할지는 선택 사항

#### 작업 순서 (사용자 승인 후)
1. 성능 리포트 정리·측정 스크립트 이전 (코드 영향 없음)
2. `GET /api/health` 명세 추가 → 구현, 보안 헤더
3. `trust proxy` + 속도 제한 (nginx IP 전달 확인 후)
4. launchd 템플릿·스크립트 → 사용자 설치

### pm (1차)
- 사용자 결정 (2026-11-19)
  - 공개 범위: **M6 끝에 공개**. 보안 점검(속도 제한·실제 IP)·백업·운영 실행 정리가 끝난 뒤 기본 인증 해제. `noindex` 해제 여부는 공개 시점에 결정
  - Playwright devDependency·Chromium 설치 **승인** (client 캡처·반응형 점검)
- server 요청한 실제 IP 전달: pm이 nginx에 반영 완료
  - `/opt/homebrew/etc/nginx/cloudflare-realip.conf`: Cloudflare 대역(IPv4·v6)에서 온 요청만 `CF-Connecting-IP`를 신뢰. 그 외 경로로 직접 들어온 요청은 실제 접속 IP 사용 (헤더 위조 방지)
  - `/portfolio/api/`에서 `X-Real-IP`, `X-Forwarded-For`를 복원된 IP 하나로 덮어써 전달 (`nginx.conf`, `nginx.https.conf` 모두)
  - server는 `trust proxy`를 loopback만 신뢰하도록 설정하면 됨
- nginx 자동 시작: server 의견대로 서버만 자동화하면 의미가 없음 → launchd 등록 3건(서버, nginx, 백업)을 묶어 사용자 승인 요청함

### client (2차) — 후속 작업 완료 (11-19)
- 반응형 점검: `npm run capture`(Playwright)로 14개 화면 × 360·768·1280px 캡처, 가로 넘침 0건. 360px에서 깨짐 2건(헤더 "로그인" 세로 접힘, S-02 관심 태그 라벨 줄바꿈) 수정 후 재캡처
- README용 캡처: `client/docs/screens/S-01.png`, `S-02.png`, `S-04.png`, `A-01.png` (1280px 첫 화면, mock 데이터라 개인정보 없음)
- mock 차단: 빌드 결과에서 `mockServiceWorker.js` 제거, `build`·`build:web` 끝에 워커 파일·mock 코드 검사(있으면 빌드 실패)
- ErrorBoundary(재배포 직후 청크 로드 실패 시 1회 자동 새로고침), 화면별 `<title>` 추가
- `build:web` 갱신함. 상세: `client/README.md` "출시 점검 (M6)"
- 공개 결정 시 남은 client 작업: meta description·OG 태그·favicon

### server (2차) — 작업 1~4 완료
- 1 성능 리포트: `server/README.md` "성능 리포트" 절 (수집·피드·검색·추천 같은 형식, 검색 923 → 301 → 94ms 과정). 측정 스크립트 `server/perf/` (대상 DB 이름 확인 후 실행)
- 2 헬스 체크·보안 헤더: `GET /api/health`(명세 먼저 추가), `Cache-Control: no-store`·`nosniff`·`no-referrer`·`X-Frame-Options: DENY`. 외부 `https://formulous.org/portfolio/api/health` 200 확인
- 3 실제 IP·속도 제한: `trust proxy loopback`, IP 기준 한도(conventions 6-1). e2e로 가입 6번째 429·다른 IP 분리·기본 한도 121번째 429·헬스 체크 제외 확인. 한도 카운터는 메모리(재시작 시 초기화)
- 4 launchd: `server/deploy/` 템플릿·`install.sh`·`deploy.sh`·`uninstall.sh`. **설치는 사용자 승인 대기** (`~/Library/LaunchAgents` 등록). 설치 전 이 세션에서 띄운 `:3000` 서버를 server가 먼저 내려야 함
- e2e 16건, 단위 112건 통과

## 결정 (pm)
- 결정 (2026-11-19)
  - client: 계획 1~3 + 추가 제안(ErrorBoundary, 화면별 `<title>`, `mockServiceWorker.js` 빌드 제외) 채택. 공개 결정 시 meta·OG·favicon 추가
  - dba: 버퍼 풀 128MB 유지 (리포트에 측정 조건 명시, `posts`+`post_search`가 버퍼 풀 70% 초과 시 재검토). 백업 14일 보관·복원 검증 채택. 스키마 문서 정리 채택
  - server: 작업 순서 1~4 채택. 속도 제한은 공개 전 필수(비기능 요구사항에 추가), `GET /api/health`·보안 헤더 채택(명세 먼저)
  - 개인정보: 탈퇴 회원 데이터가 백업에 최대 14일 남는 점을 비기능 요구사항에 명시, 공개 시 개인정보 안내 문구에 반영
  - 공개: M6 끝에 공개 (사용자 결정)
- 근거: 공개 전 최소 보안(속도 제한·실제 IP)과 운영 지속성(자동 시작·백업) 확보가 출시 조건. 버퍼 풀 증설은 실데이터 6MB라 이득 없고 같은 컨테이너 다른 DB에 영향
- 후속 작업
  - pm - nginx 실제 IP 전달 (완료), `02-features.md` v1.7 비기능 보안·개인정보 (완료), `05-portfolio-summary.md`·`06-acceptance-checklist.md` 작성, 공개 전환(nginx 기본 인증 해제)
  - 사용자 - launchd 등록 승인 (서버·nginx·백업), `db/conf` 마운트 전환은 선택
  - server - 성능 리포트 → health·보안 헤더 → trust proxy·속도 제한 → launchd 템플릿
  - dba - 백업·복원 스크립트, 복원 검증 결과 기록, 스키마 문서 정리, 리포트용 핵심 결정 3가지
  - client - Playwright 캡처·반응형 점검, mock 워커 제외, ErrorBoundary, `<title>`
