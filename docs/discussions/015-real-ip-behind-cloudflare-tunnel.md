# 015. [긴급] Cloudflare Tunnel 뒤에서 실제 IP가 127.0.0.1로 전달됨 → 속도 제한 전체 공유

- 상태: decided
- 제기: server
- 관련: pm
- 관련 문서: `docs/discussions/014` (속도 제한·실제 IP), `docs/api/conventions.md` 6-1, `/opt/homebrew/etc/nginx/cloudflare-realip.conf`, `~/workspace/README.md`

## 배경
- 공개 전환(2026-11-19) 직후 server가 외부 경로로 확인함
- `https://formulous.org/portfolio/api/tags`와 로컬 `127.0.0.1:3000/api/tags`를 번갈아 호출하니 `X-RateLimit-Remaining`이 116 → 115 → 114 → 113으로 **같은 한도를 공유**함
- 즉 서버는 외부 방문자를 모두 127.0.0.1 한 명으로 보고 있음

## 원인 (설정 읽기만 함)
- 외부 요청 경로: 브라우저 → Cloudflare → `cloudflared tunnel`(맥미니 로컬 프로세스) → nginx `:80` → 서버 `:3000`
- `cloudflared`가 nginx에 **127.0.0.1에서** 접속함 (nginx `access.log`에도 `127.0.0.1`로 기록)
- `cloudflare-realip.conf`는 `real_ip_header CF-Connecting-IP`와 Cloudflare 공인 대역 `set_real_ip_from` 22개만 있고, `127.0.0.1`·`::1`은 없음 → 실제 IP 복원이 적용되지 않아 `$remote_addr = 127.0.0.1`
- nginx가 `X-Forwarded-For $remote_addr`로 넘기므로 서버도 127.0.0.1로 봄

## 영향 (공개 상태라 긴급)
- 모든 방문자가 IP 한도 하나를 공유: 기본 1분 120회, **가입은 서비스 전체 10분 5회**, 로그인 1분 10회, 검색·조회 기록 1분 60회
- 방문자 몇 명만 있어도 429가 날 수 있고, 한 명이 한도를 다 쓰면 전원이 막힘
- nginx 접근 로그·통계도 전부 127.0.0.1

## 제안 (pm, nginx)
- `cloudflare-realip.conf`에 터널 출발지 추가
  ```nginx
  set_real_ip_from 127.0.0.1;
  set_real_ip_from ::1;
  ```
  - 맥미니에 로컬로 접속할 수 있는 프로세스만 `CF-Connecting-IP`를 위조할 수 있어 위험이 작음 (3000·80 포트는 공유기에서 외부로 열려 있지 않다는 전제, `~/workspace/README.md`)
- 반영: `nginx -t && nginx -s reload`
- 확인 방법: 외부 경로와 로컬 호출의 `X-RateLimit-Remaining`이 서로 따로 줄어들면 정상. nginx `access.log`에 실제 공인 IP가 찍힘

## server 쪽 대안 (nginx 수정이 어려울 때만)
- 서버가 `CF-Connecting-IP` 헤더를 직접 읽는 방식도 가능하지만, nginx 한 곳에서 IP를 정리하는 지금 구조(014 결정)가 더 단순함. 서버 변경 없이 nginx 수정을 권장함
- nginx 반영 전까지 임시로 속도 제한을 끌지(`RATE_LIMIT_ENABLED=false`, `.env` 수정 = 사용자 작업) 여부는 pm·사용자 판단

## 의견

### server (1차)
- nginx 수정 후 server가 같은 방법으로 다시 확인하고 이 문서에 결과를 남김

## 결정 (pm)
- 결정 (2026-11-19): server 제안 채택, 즉시 반영
  - `cloudflare-realip.conf` 맨 앞에 `set_real_ip_from 127.0.0.1;`, `set_real_ip_from ::1;` 추가 → `nginx -t` 통과, reload
  - 확인: 외부 경로와 로컬 `:3000` 호출의 `X-RateLimit-Remaining`이 각각 119 → 118로 따로 줄어듦 (공유 해소). nginx `access.log`에 공인 IP 기록
  - 임시 속도 제한 해제는 불필요 (즉시 반영으로 해결)
- 근거: 외부 트래픽이 Cloudflare Tunnel(`cloudflared`, 로컬 프로세스)로 들어오므로 터널 출발지(loopback)를 신뢰해야 실제 IP가 복원됨. loopback 위조는 맥미니 로컬 프로세스만 가능해 위험 작음. 014 설계 시 터널 경로를 확인하지 못한 pm 누락
- 후속 작업:
  - server - 같은 방법으로 재확인 후 결과 기록
  - pm - `~/workspace/README.md` 실제 IP 설명 갱신 (완료)
