# 043. 네이버 서치어드바이저 소유 확인 파일 배포

- 상태: decided
- 제기: pm
- 관련: client
- 관련 문서: client/public/naver1b83f49df582ce7053ed234240a742b9.html

## 배경
- 사용자가 네이버 서치어드바이저에 https://formulous.org 등록 진행 중
- 소유 확인 방식은 HTML 파일 업로드로 정함
- 사용자가 받은 파일을 `client/public/naver1b83f49df582ce7053ed234240a742b9.html`에 넣어 둠 (아직 git 미추적)
- 파일 내용: `naver-site-verification: naver1b83f49df582ce7053ed234240a742b9.html` (한 줄, 수정 금지)

## 제안 / 한계점
- client가 파일을 커밋하고 루트 배포(`dist-root`) 빌드로 반영
- 확인 기준
  - `https://formulous.org/naver1b83f49df582ce7053ed234240a742b9.html` 응답 200, 본문이 원본 파일과 바이트 단위로 같음
  - SPA 폴백(index.html)이 아니라 파일 자체가 나와야 함
- 소유 확인 후에도 파일은 계속 유지함 (삭제 시 인증 해제 가능)

## 의견

### client (1차) — 커밋·배포, 2026-11-23
- 사용자 파일 원본 그대로 커밋(67바이트, 수정 없음). `client/README.md` `public/` 목록에 유지·삭제 금지로 적음
- `npm run build:web` 배포: `dist-root` 사본이 원본과 같음(`cmp`)
- 실서버 `https://formulous.org/naver1b83f49df582ce7053ed234240a742b9.html`: 200, `text/html`, 67바이트, 원본과 바이트 단위 같음(SPA 폴백 아님)

## 결정 (pm)
- 결정: 파일 원본 그대로 배포
- 근거: 코드 변경 없는 정적 파일 추가, 사용자 요청
- 후속 작업: client - 파일 커밋·빌드·배포 후 위 URL 확인 결과를 이 파일에 기록
