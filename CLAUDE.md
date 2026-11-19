# portfolio 팀 공통 규칙

이 저장소는 herdr pane 4개에서 Claude Code 세션 4개가 역할을 나눠 개발함. 각 세션의 역할은 `--append-system-prompt-file roles/<역할>.md`로 주입됨.

## 서비스 범위
- 1인이 기획·개발·운영하는 이력서 포트폴리오용 웹 서비스
- 주제는 PM이 제안하고 사용자가 최종 선택함

## 팀 구성 (herdr agent 이름)
| 이름 | 역할 | 쓰기 가능 경로 |
|---|---|---|
| `pm` | 기획자 | `docs/spec/`, `docs/discussions/` |
| `client` | React 클라이언트 개발자 | `client/`, `docs/discussions/` |
| `server` | NestJS 서버 개발자 | `server/`, `docs/api/`, `docs/discussions/` |
| `dba` | MariaDB 데이터베이스 관리자 | `db/`, `docs/schema/`, `docs/discussions/` |

- 다른 역할의 쓰기 경로는 읽기만 함. 수정이 필요하면 해당 역할에게 요청함
- `onyx-ui/` 서브모듈은 `client`만 사용함. 수정이 필요하면 `onyx-ui-change` skill 절차를 따르고 사용자 승인을 받음
- 루트의 `CLAUDE.md`, `README.md`, `roles/`, `herdr/`는 사용자 승인 없이 수정하지 않음. 단, `README.md`의 "진행 현황" 섹션은 `pm`이 갱신함

## 진행 순서 (계약 우선)
1. `pm`: 아이디어 제안 → 사용자 선택 → `docs/spec/`에 기획서 작성
2. `dba`: `docs/schema/`에 ERD·DDL 초안 작성 → `server`가 검토
3. `server`: `docs/api/openapi.yaml` 작성 → `client`·`pm`이 검토
4. `client`: 확정된 API 명세를 기준으로 화면 개발. 서버 구현 전에는 mock 사용
5. 구현 중 명세 변경이 필요하면 discussion을 열고, 명세 소유 역할이 문서를 먼저 갱신한 뒤 구현함

## 역할 간 소통
- 의견 교환은 `docs/discussions/NNN-주제.md`에 기록함 (`_template.md` 복사, NNN은 3자리 일련번호)
- 기록한 뒤 상대 역할에게 herdr로 짧게 알림:
  ```bash
  herdr agent prompt <대상이름> "[from:<내이름>] docs/discussions/NNN-주제.md 확인 요청: <한 줄 요약>"
  ```
  - `--wait`는 붙이지 않음. 서로 기다리다 교착 상태에 빠지는 것을 막기 위함
  - 상대가 `blocked` 상태라 거절되면 다시 보내지 말고 discussion 파일에만 남김
- 알림 메시지 본문에 긴 내용을 넣지 않음. 내용은 항상 discussion 파일에 씀
- 한 discussion당 왕복은 최대 3회. 합의되지 않으면 `pm`이 결정하고, `pm`도 결정할 수 없으면 사용자에게 에스컬레이션함
- `[from:...]` 알림을 받으면 하던 작업을 정리한 뒤 discussion 파일을 읽고, 같은 파일에 의견을 추가함

## 공통 기술 기준
- DB: Docker 컨테이너 `mariadb` (MariaDB 12.1, `localhost:3306`)를 사용함. 접속 정보는 `server/.env`에 둠. `.env` 파일은 읽거나 수정하지 않음. 필요하면 사용자에게 요청함
- 언어: TypeScript
- 응답·문서 문체: 간결한 음슴체
- 코드 주석은 쓰지 않음
- 작업 단위가 끝나고 검증이 통과하면 묻지 않고 커밋함. push는 사용자가 요청할 때만 함
  - 메시지는 Conventional Commits 형식이고 scope로 역할을 씀 (예: `feat(server): ...`)
  - 여러 세션이 같은 저장소를 쓰므로 자기 쓰기 가능 경로의 파일만 커밋함. 다른 역할의 파일이 스테이징되어 있어도 섞이지 않게 `git commit -m "<메시지>" -- <경로...>` 형식으로 경로를 지정함
  - `index.lock` 오류가 나면 몇 초 뒤 다시 시도함. lock 파일을 직접 지우지 않음
