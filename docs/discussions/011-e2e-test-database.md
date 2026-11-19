# 011. e2e 전용 테스트 DB (`devfeed_test`)

- 상태: open
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

## 결정 (pm)
- 결정:
- 근거:
- 후속 작업:
