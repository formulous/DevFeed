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

### dba (1차) — 5단계 준비: 데이터 마이그레이션 `0016` 작성·검증
- `db/migrations/0016_rename_formulous_root_urls.sql` (데이터만, DDL 없음)
  - 내부 소스(`internal:community`) 이름 "DevFeed 커뮤니티" → "formulous 커뮤니티", `site_url` → `https://formulous.org/community`
  - 커뮤니티 글 `posts.url`이 `https://formulous.org/dev-feed/community/posts/{자기 id}`와 정확히 같을 때만 `https://formulous.org/community/posts/{id}`로 변경 (`url_hash` 생성 컬럼 자동 재계산, 충돌 없음). down은 역변환
  - 마이그레이션으로 둔 이유: 새 DB(테스트·측정)도 `0015` 뒤 같은 결과가 되도록
- 운영 사전 조회 (읽기만): 커뮤니티 글 32건 모두 옛 형태, 블로그·보안 뉴스 url 중 `/dev-feed` 0건(외부 원문), 내부 소스 id 81
- 검증: `devfeed_test`·`devfeed_perf` up → down → up 통과
- **적용 조건**: 2단계(server `WEB_BASE_URL=https://formulous.org` 재시작) 이후 + 사용자 승인. 그 전에 적용하면 사이에 쓴 글이 옛 주소로 남음 (남더라도 `0016` 재실행 대신 같은 UPDATE를 한 번 더 하면 됨)
- `/ads.txt`·쿠키 경로·RP ID는 DB 무관. 백업 파일 이름·경로(`~/backups/devfeed`)와 DB 이름 `devfeed`는 내부 이름이라 그대로 둠

### pm (server 검토 수용, 2026-11-23)
- 수용. 순서 조정: **3단계 nginx reload 직후 사용자 `.env` 변경 → server 재시작**(pm이 server에 알림). 5단계 dba url 일괄 변경은 재시작 뒤에 실행해 그 사이 저장된 글도 같이 정리
- nginx `/api/` 블록은 기존 블록에서 `proxy_cookie_path`만 빼고 realip·헤더·noindex 유지
- 6단계 범위(기본 RP 이름, 크롤러 UA, README·openapi 문구) 수용, 내부 이름(launchd 라벨·패키지명·DB명) 유지 수용

### pm (0016 운영 적용 승인, 2026-11-23)
- **사용자 승인 (2026-11-23): 0016 운영 적용 진행.** 적용 시점은 3단계 nginx 전환 + server 재시작 뒤. pm이 재시작 완료를 dba에 알리면 적용

### client (1단계 완료, 2026-11-23)
- 이름·로고: 화면·메타의 "DevFeed" → formulous (헤더·로그인 화면 로고, 문서 제목 `<화면> · formulous`, 푸터, 로그인·가입 제목, 프로필 카드 안내, 개인정보 안내). 로고 `f.` 아이콘(반전 배경 + 강조색 점, 라이트·다크 대응) + 소문자 `formulous` 워드마크. favicon·og 이미지 새로 생성
- `index.html`: title·og·twitter 제목 `formulous — 기술·보안 뉴스와 개발자 커뮤니티`, og:url `https://formulous.org/`, og:image `https://formulous.org/og.png`
- `public/`: `ads.txt`(home과 같은 내용, `diff` 일치), `robots.txt`(`/admin`·`/me/`·`/onboarding/`·`/community/new` 제외, sitemap 주소), `sitemap.xml`(공개 목록 10개 주소)
- 빌드: `npm run build:web` → **`client/dist-root/`** (`VITE_BASE=/`). `check-build`가 `/dev-feed/`·`/portfolio/`·`DevFeed` 0, `ads.txt` 내용, `/assets/` 루트 경로 확인. 기존 `dist-web/`(`/dev-feed/`)은 건드리지 않음 → 전환 전까지 지금 서비스 그대로
- API는 `${BASE_URL}api` = `/api/...`, 라우터 basename `/`라 nginx에서 `/` → `dist-root` (SPA `try_files $uri /index.html`), `/api/` → `127.0.0.1:3000/api/`이면 됨. `/assets/`는 해시 파일이라 기존처럼 긴 캐시, `index.html`은 no-cache 권장
- 브라우저 저장소 키(`devfeed-color-scheme` 등)는 화면에 안 보이는 내부 이름이라 그대로 둠 (바꾸면 사용자 테마 선택·글 임시 저장이 사라짐)
- mock 소스 이름 "formulous 커뮤니티"로 맞춤 (dba 5단계와 같음)
- 검증: 테스트 214건·빌드(`dist`, `dist-root`) 통과, 로컬 1440 라이트·360 다크·로그인 다크 로고 확인, "DevFeed" 0, 넘침 0
- 다음: 2단계(사용자 `.env`)·3단계(pm nginx) 후 client가 실서버 전 화면 확인함

### pm (3·4단계 nginx 전환 완료, 2026-11-23)
- `nginx.conf`(사용 중)·`nginx.https.conf` 같게: `/api/` 프록시(기존 블록에서 `proxy_cookie_path`만 뺌), `/` → `client/dist-root`(SPA), `/assets/` 1년 캐시·`/index.html` no-cache, `/dev-feed`·`/dinner-picker`·`/severance-calc`·`/salary-calc` `return 404`, home·`error_page 404 /404.html` 삭제. `nginx -t` 통과, reload
- 공개 확인: `/`·`/tech`·`/community/posts/2634`·`/ads.txt`·`/robots.txt`·`/og.png`·`/api/health`·`/api/community/posts` 200, `/dev-feed/`·`/dev-feed/tech`·`/dev-feed/api/health`·테스트 서비스 3곳 404, 제목·og:url 새 값
- 다음: 사용자 `.env` 변경 → server 재시작 → dba 0016 → client 실서버 확인

### pm (2단계 완료, 2026-11-23)
- 사용자가 `server/.env` `WEB_BASE_URL=https://formulous.org`·`WEBAUTHN_RP_NAME=formulous`로 바꾸고 `launchctl kickstart -k`로 재시작. 새 PID 실행 중, `/api/health` 200
- dba: 0016 운영 적용 진행 부탁 (사용자 승인 완료). server: 6단계 진행 부탁

### dba (2차) — 5단계 `0016` 운영 적용 완료 (2026-11-23)
- server 재시작(`WEB_BASE_URL=https://formulous.org`) 확인 후 적용 (사용자 승인)
- 커뮤니티 글 32건: 옛 형태 32 → 새 형태 `https://formulous.org/community/posts/{id}` 32, 다른 형태 0. DB 전체 url 중 `/dev-feed` 포함 0
- 내부 소스 id 81: "formulous 커뮤니티", `https://formulous.org/community`
- 정합성 검사 커뮤니티 8·점수 6·좋아요/댓글 6항목 전부 0. 공개 API `/api/community/posts` 응답 url 새 주소 확인
- 참고: url을 바꾼 32행은 `posts.updated_at`이 적용 시각으로 갱신됨 (화면 수정 표시는 `community_posts.edited_at`이라 영향 없음)
- dba 037 작업 끝

### server (6단계 완료, 2026-11-23)
- 기본 RP 이름 `DevFeed` → `formulous` (`env.ts`, `.env.example`), 크롤러 User-Agent `formulousBot/0.1`
- `server/README.md` 제목·공개 주소(`https://formulous.org/api/...`)·`WEB_BASE_URL`·RP 이름 운영값, `openapi.yaml` 제목·설명·예시(`formulous 커뮤니티`) 갱신
- 패스키 e2e가 RP 이름을 고정 문자열 대신 설정 값으로 비교하게 바꿈
- 서버 코드·문서에 `DevFeed`·`/dev-feed/api` 0 (launchd 라벨·패키지명·DB명은 내부 이름이라 유지)
- 커밋 `e382127`, 배포 완료. unit 174, e2e 84 통과, lint 기존 8 errors 그대로
- 공개 확인: `/api/health` 200, 패스키 로그인 옵션 200, `/api/community/posts` 최신 글 `url`이 `https://formulous.org/community/posts/{id}`
