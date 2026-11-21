# 028. 프로젝트명·공개 주소를 dev-feed로 변경

- 상태: open
- 제기: pm (사용자 요청)
- 관련: client, server
- 관련 문서: `README.md`, `client/package.json` `build:web`, `client/index.html`, `server/deploy/`, nginx(`/opt/homebrew/etc/nginx/nginx.conf`·`nginx.https.conf`, pm 담당)

## 배경
- 사용자 요청 (2026-11-22): 프로젝트명과 주소를 `portfolio` → `dev-feed`로 변경
- 사용자 결정
  - 공개 주소: `https://formulous.org/portfolio/` → **`https://formulous.org/dev-feed/`** (경로만 변경, DNS·인증서 작업 없음)
  - 로컬 폴더 `~/workspace/project/portfolio`는 **유지** (herdr 세션·launchd 경로 중단 방지)
  - 옛 주소 `/portfolio/`는 **리다이렉트 없이 없앰** (404)

## 결정 (pm)
### 바꾸는 것
| 대상 | 변경 | 담당 |
|---|---|---|
| nginx `/portfolio/`·`/portfolio/api/` | `/dev-feed/`·`/dev-feed/api/`, 쿠키 경로 `/dev-feed/api/`, API `noindex` 유지 | pm |
| client `build:web` | `VITE_BASE=/dev-feed/` | client |
| client `index.html` | `og:url`·`og:image`·canonical 등 절대 주소 `https://formulous.org/dev-feed/` | client |
| client 그 외 | 빌드 검사 스크립트·sitemap·robots·문서 안 주소가 있으면 같이 | client |
| server launchd 라벨 | `org.formulous.portfolio-server` → `org.formulous.dev-feed-server`, `portfolio-logrotate` → `dev-feed-logrotate` (옛 에이전트 내리고 새 에이전트 올림, 서버 다운타임 최소) | server |
| server 문서·스크립트 안 주소 | `/portfolio/api` → `/dev-feed/api` | server |
| 루트 `README.md` 서비스 주소·구조도, `CLAUDE.md`·`roles/*.md` "portfolio 팀", `herdr/start.sh` workspace 라벨 | `dev-feed` (사용자 요청에 따른 변경) | pm |

### 바꾸지 않는 것
- 로컬 폴더 경로(`.../project/portfolio`), nginx `alias` 실제 경로, launchd plist 안 작업 경로
- 지난 discussion 기록 속 옛 주소 (당시 기록이므로 그대로)
- 패스키 RP ID `formulous.org`·`WEBAUTHN_ORIGINS=https://formulous.org` (도메인 그대로라 기존 패스키 계속 동작)
- AdSense 사이트(`formulous.org`) 그대로

### 영향
- 리프레시 쿠키 경로가 바뀌어 기존 로그인 상태가 한 번 풀림 (다시 로그인 필요). 허용
- 옛 링크(이력서·공유 링크·검색 색인)는 404. 사용자가 이력서 등 외부 링크를 새 주소로 바꿔야 함

### 순서 (끊김 최소)
1. pm: nginx에 `/dev-feed/` 위치 **추가** (옛 위치와 함께 운영), reload
2. client: `VITE_BASE=/dev-feed/`로 `build:web` 배포 → `/dev-feed/` 확인 후 알림
3. pm: nginx에서 `/portfolio/` 위치 **삭제**, reload → 옛 주소 404 확인
4. server: launchd 라벨 변경(독립 진행 가능), 문서 갱신
5. pm: 공개 확인(로그인·패스키·API·og), README·문서 갱신 후 종결

## 수용 기준
- `https://formulous.org/dev-feed/` 모든 화면·API·로그인·패스키 로그인 동작, 새로고침·직접 진입(SPA 경로) 정상
- `https://formulous.org/portfolio/`·`/portfolio/api/` 404
- `og:url`·`og:image`가 새 주소, 빌드 결과에 `/portfolio/` 문자열 0
- launchd `org.formulous.dev-feed-server` 실행 중, 옛 라벨 에이전트 없음, 재부팅 시 자동 실행 설정 유지

## 의견

### pm (1단계 완료, 2026-11-22)
- nginx(`nginx.conf` 사용 중, `nginx.https.conf`도 같게)에 `/dev-feed/`·`/dev-feed/api/` 추가, reload. `/dev-feed/` 200, `/dev-feed/api/posts` 200, `/portfolio/` 아직 200(병행)
- client: 2단계 진행 부탁. server: 4단계 독립 진행 가능

### server (4단계 완료)
- launchd 라벨 변경: `org.formulous.dev-feed-server`·`org.formulous.dev-feed-logrotate`
  - 새 plist 먼저 만들고 옛 서버 내림 → 새 서버 올림, 다운타임 약 2초. 옛 라벨 에이전트·plist 없음 확인
  - `RunAtLoad`·`KeepAlive` 유지(재부팅 자동 실행), `deploy.sh` 재배포 정상
  - plist 템플릿 파일명·`common.sh`·`install*.sh` 반영. 작업 경로(`.../project/portfolio/server`)는 그대로
- 문서: `server/README.md` 라벨·공개 주소 `/dev-feed/api`로 변경. `docs/api/`에는 옛 주소 없음
- 확인: `https://formulous.org/dev-feed/api/health`·`/sources` 200, 패스키 옵션 `rpId: formulous.org`
- 리프레시 쿠키: 서버는 `Path=/api/auth` 그대로, nginx `/dev-feed/api/` 위치의 `proxy_cookie_path /api/ /dev-feed/api/`가 바꿔 줌 → server 변경 불필요

### pm (server 4단계 확인, 2026-11-22)
- `launchctl list`: `org.formulous.dev-feed-server` 실행 중(PID 있음), `dev-feed-logrotate` 등록, 옛 `portfolio-*` 에이전트·plist 0. `/dev-feed/api/posts` 200
- 남은 것: client 2단계 배포 → pm 3단계(옛 위치 삭제)
