# 037. 메인 도메인 연결(`formulous.org/`)과 서비스 이름 변경(formulous)

- 상태: open
- 제기: pm (사용자 요청)
- 관련: client, server, dba
- 관련 문서: `README.md`, `docs/discussions/028`, nginx(`/opt/homebrew/etc/nginx/nginx.conf`·`nginx.https.conf`, pm 담당)

## 배경
- 사용자 요청 (2026-11-23)
  - `formulous.org` 메인 도메인을 이 서비스에 연결. 주소에서 `/dev-feed` 한 단계를 없앰
  - 기존 테스트 서비스(퇴직연금 계산기 `/severance-calc/`, 오늘 저녁 뭐먹지 `/dinner-picker/`, 연봉 계산기 `/salary-calc/`)와 기존 메인 페이지(home)는 내림
  - 서비스 이름을 "formulous라는 개발자가 운영하는 기술·보안 뉴스와 커뮤니티" 느낌으로 로고와 함께 변경
- 사용자 결정
  - 이름: **formulous**, 로고 `f.` (소문자 워드마크 + 점), 제목 "formulous — 기술·보안 뉴스와 개발자 커뮤니티"
  - 옛 주소 `/dev-feed/...`: **404** (넘김 없음)
  - 테스트 서비스·home: **nginx 연결만 끊음**, 로컬 폴더는 그대로

## 결정 (pm)
### 주소
| 대상 | 변경 전 | 변경 후 |
|---|---|---|
| 웹 | `https://formulous.org/dev-feed/…` | `https://formulous.org/…` (`/tech`, `/community`, `/security` …) |
| API | `/dev-feed/api/` (쿠키 경로를 nginx가 `/dev-feed/api/`로 바꿈) | `/api/` (서버 기본 쿠키 경로 `/api/auth` 그대로, `proxy_cookie_path` 불필요) |
| 옛 주소 | | `/dev-feed`, `/dev-feed/…` 404 |
| 테스트 서비스·home | `/severance-calc/`, `/dinner-picker/`, `/salary-calc/`, `/`(home) | nginx에서 삭제 → 404 또는 새 서비스 화면 |
- 패스키 RP ID `formulous.org`·origin `https://formulous.org`은 그대로라 기존 패스키 계속 동작
- 리프레시 쿠키 경로가 바뀌어 기존 로그인은 한 번 풀림 (028과 같음, 허용)
- AdSense: 사이트 `formulous.org` 그대로. **`/ads.txt`는 지금 home에서 나오고 있으므로 새 빌드 루트에 같은 내용으로 둬야 함** (빠지면 광고 수익 중단)

### 이름·로고 (client)
- 화면 이름 "DevFeed" → **formulous** (헤더 로고, 문서 제목, og·twitter 메타, 푸터, 빈 상태·로그인·가입·탈퇴·개인정보·등급 안내 등 문구 전체)
- 로고: 소문자 `formulous` 워드마크, 아이콘은 `f.` (점은 강조색 1곳). 라이트·다크 대응. favicon·og 이미지 새로 생성
- 문서 제목 형식: `<화면> · formulous`, 메인 description "formulous — 기술·보안 뉴스와 개발자 커뮤니티"
- `public/`에 `ads.txt`(home과 같은 내용), `robots.txt`, `sitemap.xml`(공개 목록 주소만) 추가

### 순서 (끊김 최소)
1. client: 이름·로고 변경 + `build:web`을 `VITE_BASE=/`로 바꾸고 **새 출력 폴더**(예: `dist-root`)에 빌드. `check-build`에 `/dev-feed/` 문자열 0 검사. 기존 `dist-web`(`/dev-feed/`)은 전환 전까지 그대로 둠 → 알림
2. 사용자: `server/.env`의 `WEB_BASE_URL`을 `https://formulous.org`로, `WEBAUTHN_RP_NAME`을 `formulous`로 변경 (pm이 명령 안내) → server 재시작
3. pm: nginx 전환 — `/api/` 프록시 추가, `/`를 새 빌드로(SPA `try_files … /index.html`), 정적 자산 캐시 규칙 유지. reload 후 공개 확인
4. pm: nginx에서 `/dev-feed`·`/dev-feed/…`(404), `/severance-calc`, `/dinner-picker`, `/salary-calc`, home `/404.html` 삭제, reload
5. dba (운영 DB 변경, 사용자 승인 후): 자유 게시판 글 `posts.url`의 `https://formulous.org/dev-feed/community/posts/` → `https://formulous.org/community/posts/` 일괄 변경, 내부 소스 이름 "DevFeed 커뮤니티" → "formulous 커뮤니티"
6. server: 문서·스크립트 안 공개 주소 `/dev-feed/api` → `/api`. launchd 라벨(`org.formulous.dev-feed-*`)은 내부 이름이라 그대로 둠
7. pm: 루트 `README.md`(서비스 주소·이름·구조도), `CLAUDE.md`·`roles/*.md`·`herdr/start.sh`의 "dev-feed" 이름, `docs/spec/` 이름 갱신 (사용자 요청에 따른 변경, 028과 같음). 로컬 폴더명 `portfolio`는 유지
8. pm: 공개 확인 후 종결

## 수용 기준
- `https://formulous.org/` → 기술 뉴스 최신(`/tech`), 모든 화면 직접 진입·새로고침, API, 로그인·패스키 로그인 정상
- `/dev-feed/`, `/dev-feed/tech`, `/severance-calc/`, `/dinner-picker/`, `/salary-calc/` 404
- `/ads.txt`가 기존과 같은 내용으로 200
- 화면·메타에 "DevFeed" 문구 0, 빌드 결과에 `/dev-feed/` 0, og 이미지·favicon 새 로고
- 자유 게시판 글 `url`이 `https://formulous.org/community/posts/{id}`
- 360·1440, 라이트·다크 정상, 페이지 오류 0

## 의견

### server (검토, 2026-11-23)
- 결정 수용. 서버 코드는 전역 prefix `api`·쿠키 경로 `/api/auth`(`df_rt`)·`df_vid` `Path=/` 그대로라 **주소 전환에 코드 변경 필요 없음**
- 3단계 nginx `/api/` 블록: 지금 `/dev-feed/api/` 블록을 그대로 옮기되 `proxy_cookie_path`만 뺌 (`proxy_pass http://127.0.0.1:3000/api/`, `cloudflare-realip.conf`, `X-Real-IP`·`X-Forwarded-For $remote_addr`, `X-Forwarded-Proto https`, `X-Robots-Tag noindex` 유지). 속도 제한이 실제 IP 기준이라 realip·헤더 빠지면 전체가 한 IP로 묶임
- **2단계 순서 제안**: `.env` 변경 후 재시작은 3단계 nginx reload 직후에 바로 붙여 주기. 먼저 재시작하면 그 사이 새 글 `url`이 아직 열리지 않은 루트 주소로 저장됨 (반대로 늦으면 `/dev-feed/` 주소로 저장 → 5단계 dba 일괄 변경이 재시작 뒤에 돌면 둘 다 정리됨). 재시작은 `bash server/deploy/deploy.sh`나 `launchctl kickstart -k gui/$(id -u)/org.formulous.dev-feed-server` — pm/사용자가 알려 주면 server가 함
- 기존 로그인: 브라우저에 남은 `/dev-feed/api/auth` 경로 `df_rt`는 더 이상 전송되지 않아 한 번 풀림 (예정대로). 서버 쪽 토큰은 만료로 정리됨
- 6단계 server 작업 범위 (전환 확인 후 진행)
  - 기본값 `WEBAUTHN_RP_NAME` `DevFeed` → `formulous` (`env.ts`, `.env.example`). 운영은 `.env` 값이 우선
  - 크롤러 User-Agent `DevFeedBot/0.1` → `formulousBot/0.1`
  - `server/README.md` 이름·공개 주소(`/dev-feed/api` → `/api`, `WEB_BASE_URL` 운영값), `docs/api/openapi.yaml` 제목·설명·예시(`DevFeed 커뮤니티` → `formulous 커뮤니티`)
  - launchd 라벨, `package.json` 이름 `devfeed-server`, DB 이름 `devfeed`은 내부 이름이라 그대로 둠
