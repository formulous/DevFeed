# portfolio

이력서 포트폴리오용 1인 서비스. Claude Code 세션 4개(기획, 클라이언트, 서버, DBA)가 herdr 위에서 역할을 나눠 개발함.

## 구조

```
portfolio/
├── CLAUDE.md          # 팀 공통 규칙 (소유권, 소통, 진행 순서)
├── roles/             # 역할 프롬프트 (pm, client, server, dba)
├── docs/
│   ├── spec/          # 기획 (pm)
│   ├── schema/        # ERD·테이블 설계 (dba)
│   ├── api/           # OpenAPI 명세 (server)
│   └── discussions/   # 역할 간 토론 기록 (_template.md)
├── client/            # React + Vite + onyx-ui (client)
├── server/            # NestJS + TypeORM (server)
├── db/                # 마이그레이션·시드 (dba)
├── onyx-ui/           # 공통 UI 서브모듈
└── herdr/start.sh     # 팀 실행 스크립트
```

## 요구 사항

- herdr (`brew install herdr`), jq, Claude Code CLI
- Docker 컨테이너 `mariadb` (MariaDB 12.1, `localhost:3306`)
  - 실행: `docker start mariadb`

## 시작

```bash
git clone --recurse-submodules <repo>    # 또는 git submodule update --init
herdr                                     # herdr TUI 실행
# herdr pane 안에서
./herdr/start.sh --kickoff
```

- `portfolio` workspace에 2x2 pane이 생기고 agent `pm`, `server`, `client`, `dba`가 실행됨
- 각 세션은 `--append-system-prompt-file roles/<이름>.md`로 역할을 주입받음
- 처음 실행할 때는 각 pane에서 Claude Code 폴더 신뢰 확인 창에 응답해야 함. 응답 후 스크립트가 안내하는 `herdr agent prompt pm ...` 명령으로 kickoff를 보냄
- `--kickoff`를 빼면 agent만 띄우고 작업 지시는 하지 않음

## 협업 방식

- 역할마다 쓰기 가능한 경로가 정해져 있음 (`CLAUDE.md` 참고)
- 의견 교환: `docs/discussions/NNN-주제.md`에 기록한 뒤 `herdr agent prompt <대상> "[from:<나>] ..."`로 알림
- discussion당 왕복은 최대 3회. 결론이 안 나면 pm이 결정하고, 그래도 안 되면 사용자에게 에스컬레이션함
- 진행 순서: 기획 → 스키마 → API 명세 → 화면 (계약 우선)
- 커밋: 각 역할이 작업 단위를 끝내고 검증을 통과하면 자기 경로만 자동으로 커밋함 (`feat(<역할>): ...`). push는 수동으로 함

## 진행 현황

- [x] 팀 골격 구성
- [x] 아이디어 후보 작성 (`docs/spec/00-ideas.md`)
- [x] 서비스 주제 선정: C. 데브피드 (기술 블로그 통합 피드 + 검색·추천)
- [x] 기획서 작성 (`docs/spec/01~04`)
- [x] M0 계약 확정: 스키마 `0001~0007`(dba), OpenAPI v1(server), 검토 완료 (discussion 001~004 decided)
- [ ] M1 수집 파이프라인 — 진행 중 (dba 시드 완료: 소스 36곳·태그 153개 / client 관리자 화면 A-01~A-04·로그인 mock 기준 완료 / server 수집 파이프라인·관리자 API 1차 구현 완료, 단위 테스트 53건 통과 / DB 연동 검증 통과(중복 0건, 실패 격리·재시도) / 005 후속 완료: 로그인·refresh·logout·잠금·`/me`, `post_search.feed_categories`(`0008`) / 남은 것: 사용자 `:3000` 점유 프로세스 종료 → client 실서버 로그인으로 A-01~A-04 확인)
- [ ] M2 피드 — client S-01 mock 기준 선행 완료
- [ ] M3 검색
- [ ] M4 회원·개인화 기본
- [ ] M5 추천
- [ ] M6 출시·성능 리포트
