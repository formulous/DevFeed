# 009. formulous.org 하위 경로 외부 확인 환경

- 상태: decided
- 제기: pm (사용자 요청)
- 관련: client, server
- 관련 문서: `/opt/homebrew/etc/nginx/nginx.conf`, `~/workspace/README.md`, `client/vite.config.ts`, `client/src/api/http.ts`, `client/src/main.tsx`

## 배경
- 사용자가 맥미니 외부에서 작업 중이라 Chrome 확장 연결 불가. 관리자 화면 등을 `https://formulous.org/portfolio/`에서 확인하길 요청함
- formulous.org는 Cloudflare → 맥미니 nginx(80)로 서빙 중. 다른 도구들은 하위 경로(`/salary-calc/` 등)로 붙어 있음

## 결정 (pm, 사용자 승인)
- 경로: `https://formulous.org/portfolio/`
  - `/portfolio/` → client 빌드 결과 `client/dist-web/` (SPA fallback)
  - `/portfolio/api/` → `http://127.0.0.1:3000/api/` 프록시. `proxy_cookie_path /api/ /portfolio/api/`로 리프레시 쿠키 경로 변환
- 접근 제한: `/portfolio/` 화면에 nginx 기본 인증(사용자가 htpasswd 직접 생성). 개발 중이므로 `X-Robots-Tag: noindex`
  - 한계: API(`/portfolio/api/`)에는 기본 인증을 걸 수 없음. 앱이 `Authorization: Bearer` 헤더를 쓰므로 Basic 인증 헤더와 충돌함. API는 앱 인증(관리자 API는 ADMIN 권한)으로만 보호됨
- 개발 서버(Vite dev)는 외부에 노출하지 않음. 프로덕션 빌드 결과만 서빙
- client 요청 사항 (client 소유 파일)
  1. Vite `base`를 환경변수 `VITE_BASE`(기본 `/`)로 설정
  2. `BrowserRouter basename`을 `import.meta.env.BASE_URL` 기준으로 설정
  3. `apiUrl`의 `/api` 접두사를 `${BASE_URL}api` 기준으로 변경 (조회 기록 `keepalive` 호출 포함)
  4. 스크립트 `build:web` = `VITE_BASE=/portfolio/ VITE_API_MOCK=false vite build --outDir dist-web` 추가, `dist-web/`는 `.gitignore`
  - 기본값(`/`)에서 기존 dev·test 동작은 그대로여야 함
- server: 변경 없음. Cloudflare HTTPS 뒤라 `Secure` 쿠키 유지 가능

## 후속 작업
- client - 위 1~4 구현, `npm run build:web` 실행 후 알림 (완료: 자산 `/portfolio/assets/`, API `/portfolio/api` 확인)
- pm - nginx 설정 추가·반영, `~/workspace/README.md` 라우팅 표 갱신 (완료: 외부 `https://formulous.org/portfolio/` 401 기본 인증 요구, `/portfolio/api/` 200)
- 사용자 - htpasswd 파일 생성 (완료. macOS nginx는 bcrypt 미지원이라 apr1(`-m`) 형식으로 재생성, 외부 접속 200 확인)
