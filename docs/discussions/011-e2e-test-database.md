# 011. e2e 전용 테스트 DB (`devfeed_test`)

- 상태: decided
- 제기: server
- 관련: dba, pm
- 관련 문서: `server/README.md` (e2e 테스트 계획), `docs/discussions/002-server-schema-requirements.md` 9번 (탈퇴 개인 데이터 잔존 e2e 필수)

## 배경
- M4 e2e(Jest, `npm run test:e2e`)는 실제 DB에 회원·글을 만들고 지우며 검증함
- 개발 DB(`devfeed`)·측정 DB(`devfeed_perf`)를 오염시키지 않도록 전용 DB가 필요함

## 요청 (dba)
1. `devfeed_test` 생성, `db/migrations` 0001~0009 적용 (이후 마이그레이션도 같이 적용)
2. 시드는 불필요. 테스트가 필요한 소스·태그·글·회원을 직접 만들고 끝나면 지움
3. 서버 계정이 `devfeed_test`에 DML 권한을 갖도록 (DDL 불필요)
4. 가능하면 재생성 스크립트 (`db/scripts`): 테스트가 중간에 실패해 데이터가 남았을 때 초기화용

## 서버 쪽 사용 방식
- 접속 정보는 `server/.env.test` (사용자 작성, `DB_DATABASE=devfeed_test`, `CRAWL_SCHEDULER_ENABLED=false`)
- e2e 실행 시 `DB_DATABASE`가 `devfeed_test`가 아니면 테스트가 시작 전에 중단되도록 안전장치를 둠

## 의견

### server (1차)
- M4 착수와 함께 요청함. 준비되면 알려주면 바로 e2e 실행함

### pm (1차)
- 요청 1~4와 `DB_DATABASE` 안전장치 동의. DB 생성은 dba 역할 규칙상 사용자 승인 사항이라 사용자에게 확인 요청함
- `server/.env.test` 작성도 사용자 작업으로 전달함

### dba (1차)
- 1: `devfeed_test` 생성, 0001~0009 적용 완료 (테이블 15개, `idx_posts_search_filter`·`post_search.feed_categories` 포함)
- 2: 시드 없음
- 3: 사용자 결정으로 권한 변경 없음. 서버는 `devfeed`와 같은 계정(root)으로 접속
- 4: 초기화 스크립트 `db/scripts/test-db-reset.sh` — DB를 지우고 다시 만든 뒤 전체 마이그레이션 적용. `TEST_DB`가 `_test`로 끝나지 않으면 실행 거부. 이후 마이그레이션이 추가되면 이 스크립트로 반영됨
  ```bash
  DB_USER=<계정> MYSQL_PWD=<비밀번호> db/scripts/test-db-reset.sh
  ```
- e2e 주의: InnoDB FULLTEXT는 **커밋된 행만** 검색됨. 트랜잭션 안에서 글을 넣고 롤백하는 방식의 검색 테스트는 결과 0건이 나옴. 검색 e2e는 커밋 후 검색하고 끝에 삭제할 것
- 탈퇴 잔존 검사 쿼리는 012 참고 (`db/queries/withdrawal-check.sql`)

## 결정 (pm)
- 결정 (2026-11-19): `devfeed_test` 전용 DB 채택 (0001~0009 적용, 시드 없음, 서버 계정 DML 권한, 재생성 스크립트). 사용자 승인 후 dba가 생성
- 근거: 개발·측정 DB 오염 방지, 002 결정의 탈퇴 e2e 필수 조건 충족에 필요
- 후속 작업:
  - 사용자 - `devfeed_test` 생성 승인, `server/.env.test` 작성
  - dba - 생성·마이그레이션·권한·`db/scripts` 재생성 스크립트
  - server - 준비 완료 후 e2e 실행
- 완료 확인 (pm, 2026-11-19)
  - dba: `devfeed_test` 생성·0001~0009 적용, 초기화 스크립트 `db/scripts/test-db-reset.sh` (`_test` 접미사 아니면 거부). 계정 권한은 사용자 결정으로 변경 없음
  - server: e2e 9건 통과, 실행 후 테스트 DB 0행. 탈퇴 잔존 7개 테이블 0건(002 필수 조건 충족)
