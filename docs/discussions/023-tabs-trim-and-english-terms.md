# 023. 탭 정리(기업·개인 탭 삭제, 게스트 추천 탭 숨김) + 기술 용어 영어 표기

- 상태: decided (구현 진행)
- 제기: pm (사용자 요청)
- 관련: client, dba, server
- 관련 문서: `docs/spec/02-features.md` F-015·F-016, `docs/spec/03-screens.md` 공통 레이아웃·S-13·S-12, `docs/discussions/021`·`022`

## 배경 (사용자 요청 2026-11-21)
1. 기업 블로그 / 개인 블로그 탭은 사이드바 `소스 유형`(전체·기업·개인)과 겹쳐 불필요 → 삭제
2. 로그인 안 했을 때 추천 탭은 굳이 안 보여도 됨
3. 한글 표기 중 업계에서 영어로 더 많이 쓰는 기술 용어는 영어로 (예: 프론트엔드 → FE)

## 결정 (pm)

### 1. 기업·개인 블로그 탭 삭제 (021 일부 철회)
- 1단 탭: `최신 · 추천 · 인기 · 보안 뉴스` (게스트는 `최신 · 인기 · 보안 뉴스`)
- 기업/개인 구분은 사이드바 `소스 유형` 세그먼트(+ 모바일 `[소스 유형 ▾]`)로만
- 예전 주소 호환: `/company` → `/?sourceType=COMPANY`, `/personal` → `/?sourceType=PERSONAL`로 바꿔 이동(`replace`, 분야 쿼리 유지). 404 없음
- S-13 화면 폐지. API 변경 없음 (`sourceType` 그대로)

### 2. 게스트에게 추천 탭 숨김
- 로그인 상태에서만 `추천` 탭 표시. 게스트는 탭 줄에서 빠짐 (자리 비움 없이 당겨짐)
- 게스트가 `/for-you`로 직접 들어오면 지금처럼 로그인 화면 → 로그인 후 `/for-you` 복귀 유지
- 로그인 직후·로그아웃 직후 탭 줄이 즉시 갱신. 로그인 상태 확인 중(새로고침 직후)에 탭이 깜빡이며 생겼다 사라지지 않게, 확인 끝나기 전에는 추천 탭 자리를 그리지 않음
- 로그인 유도는 다른 곳에서 유지: 헤더 `로그인` 버튼, 북마크 ☆ 클릭 시 로그인 유도 모달

### 3. 기술 용어 영어 표기
- 원칙: **업계에서 영어(약어 포함) 표기가 더 흔한 기술 용어는 영어**. 일반 UI 문구(최신·인기·전체·태그·소스·북마크·설정·로그인 등)와 영어로 바꾸면 더 어색한 말은 한글 유지
- 분야 탭(2단): `전체 · BE · FE · AI · Data · Infra · Mobile · Security`
  - `BE`·`FE`는 마우스 올리면 `Backend`·`Frontend` 툴팁, 스크린리더 라벨도 풀네임
  - URL 쿼리 값(`?field=backend` 등)·API enum은 그대로
- 태그 분류(S-12 분류 탭, 관리자 태그 사전): 기술 분류는 영어 — `Backend · Frontend · AI · Data · Database · Infra · DevOps · Cloud · Mobile · Security · Architecture · Language · Quality · Design · Domain`, `문화`·`기타`는 한글 유지
- 태그 이름: 아래 기준으로 영어화
  - 예: 테스트→Testing, E2E 테스트→E2E Testing, A/B 테스트→A/B Testing, 인증→Authentication, 캐시→Cache, 모니터링→Monitoring, 로깅→Logging, 옵저버빌리티→Observability, 배치→Batch, 메시지 큐→Message Queue, 샤딩→Sharding, 인덱스→Index, 트랜잭션→Transaction, 서버리스→Serverless, 서비스 메시→Service Mesh, 모노레포→Monorepo, 마이크로 프론트엔드→Micro Frontends, 디자인 시스템→Design System, 디자인 패턴→Design Pattern, 클린 아키텍처→Clean Architecture, 이벤트 기반 아키텍처→Event-Driven Architecture, 분산 시스템→Distributed Systems, 동시성→Concurrency, 비동기→Async, 코루틴→Coroutine, 상태 관리→State Management, 리팩터링→Refactoring, 머신러닝→Machine Learning, 딥러닝→Deep Learning, 자연어 처리→NLP, 컴퓨터 비전→Computer Vision, 프롬프트 엔지니어링→Prompt Engineering, AI 에이전트→AI Agent, AI 코딩 도구→AI Coding Tools, 데이터 파이프라인→Data Pipeline, 데이터 웨어하우스→Data Warehouse, 검색 엔진→Search Engine, 추천 시스템→Recommender System, 웹 성능→Web Performance, 웹 접근성→Web Accessibility(또는 a11y), 성능 최적화→Performance, 쿼리 최적화→Query Optimization, 오픈소스→Open Source, 애자일→Agile, 네트워크→Network, 암호화→Cryptography
  - 한글 유지 예: 개발 문화, 기술 부채, 코드 리뷰, 회고, 채용, 컨퍼런스, 결제, 커머스, 핀테크, 개인정보, 대규모 트래픽, 게임 서버, 데이터 분석, 보안(→ 분류와 겹치므로 `Security`로 바꿔도 됨, dba 판단)
  - 최종 목록은 dba가 위 기준으로 153개 전수 정리 → pm 검토 후 적용
- **검색·자동 태깅 손실 금지**: 기존 한글 이름은 동의어로 남겨서 "캐시"로 검색·태깅해도 `Cache` 태그가 잡혀야 함. 태그 ID는 유지(이름만 변경) → 북마크·관심 태그·URL `tagIds` 영향 없음
- 정렬: 태그 이름순 정렬이 바뀌는 것은 허용

## 수용 기준
- 게스트 탭 3개, 회원 탭 4개. 새로고침 직후 추천 탭 깜빡임 없음
- `/company`·`/personal` 접속 시 해당 `sourceType` 필터가 걸린 최신 피드로 이동
- 분야 탭·S-12 분류 탭·태그 칩이 영어 표기. "캐시"·"테스트"·"인증" 검색 결과가 변경 전과 같음, 자동 태깅 결과 변화 없음(재태깅 전후 태그 수 동일)
- 1280×720 사이드바 스크롤 없음, 360px 가로 넘침 0 유지

## 후속 작업
- client - 1·2번, 분야 탭 영어 라벨, 분류 라벨 표시. 배포 후 알림
- dba - 태그 153개 영어화 목록(바꿀 것/유지할 것) 작성 → pm 검토 → 한글 이름 동의어 보존 마이그레이션(또는 데이터 스크립트). 분류 값 변경 방식(DB 값 변경 vs 표시 라벨만) server와 정함
- server - 분류 값을 DB에서 바꾸면 분야 상수(`field → category[]`) 동시 갱신, 캐시 무효화. 검색 토큰·자동 태깅이 동의어로 계속 동작하는지 e2e 확인
- pm - `02-features.md`·`03-screens.md` 반영 (완료), 목록 검토, 공개 페이지 확인

## 의견

### server (1차)
- 1·2번(탭 삭제·게스트 추천 숨김): API 변경 없음. `sourceType`·`/recommendations` 그대로
- 분류 값 변경 방식 제안: **DB 값 변경** (`tags.category`가 자유 VARCHAR라 마이그레이션 없이 데이터만 바꾸면 됨). 표시 라벨만 바꾸면 client·관리자 화면·서버 분야 상수가 매핑을 각각 들고 있어야 해서 비추천
  - 대응표(서버 기준): 백엔드→Backend, 아키텍처→Architecture, 프론트엔드→Frontend, 디자인→Design, 데이터→Data, 데이터베이스→Database, 인프라→Infra, 클라우드→Cloud, 모바일→Mobile, 보안→Security, 언어→Language, 품질→Quality, 도메인→Domain. `AI`·`DevOps`·`문화`는 그대로 (현재 운영 분류 16종 확인)
  - 위 영어 값 철자를 바꾸면 server에 알려 줘야 함 (분야 상수와 문자열 일치로 묶음)
- 분야 상수 갱신 (완료): `posts/fields.ts`가 전환 기간 동안 한글·영어 값을 모두 같은 분야로 묶음 → dba 데이터 변경과 server 배포 순서 상관없이 분야 탭 결과 유지. dba 적용 확인 후 한글 값 제거 예정
- 동의어 보존 검증 (완료, e2e `english-tags.e2e-spec.ts`): 한글 이름 태그 → 영어 이름 + 한글 동의어 + 분류 `Backend`로 바꾸고 재태깅
  - 태그 글(제목 매칭·피드 카테고리 매칭) 전후 동일, 한글 검색 결과 동일(피드 카테고리로만 태그된 글 포함), 영어 이름 검색도 같은 결과, 분야 탭 포함 유지
  - 검색 색인은 태그 이름 + 동의어를 함께 넣으므로 한글 이름을 동의어로 남기면 손실 없음. 기존 색인은 한글 이름을 이미 가지고 있어 재태깅 전에도 검색 결과 그대로
- dba 적용 시 주의
  - 태그 사전 캐시는 TTL이 없음 → DB를 직접 바꾸면 server 재시작 필요(알려 주면 바로 재시작). 분야 태그 ID 캐시는 1분
  - 재태깅(관리자 `POST /admin/tags/retag`)은 필수 아님. 하면 새 영어 이름이 검색 색인에 들어가 영어 검색도 기존 글에 잡힘 → 수용 기준 "재태깅 전후 태그 수 동일" 확인용으로 server가 적용 후 전후 비교 실행 가능
- 검증: 단위 122건, e2e 45건 통과

### dba (1차) — 태그 영어화 목록·분류 값 변경 방식·태깅 영향 (2026-11-21)

#### 1. 태그 153개 전수 분류
- 바꿈 47 / 한글 유지 13 / 이미 영어 93 (변경 없음). 태그 ID·slug 유지, 이름만 변경
- 매칭 규칙 주의: 자동 태깅은 **태그 이름도 매칭어**로 씀 (`tagger.ts`). 기존 한글 이름은 동의어로 옮겨 손실 0. 새 영어 이름이 기존 동의어와 같으면 매칭어 집합이 그대로라 태깅 변화 0, 새 단어면 매칭어가 하나 늘어남

| 분류 | 기존 | 변경 | 글 수 | 새 이름이 기존 동의어? |
|---|---|---|---|---|
| 프론트엔드 | 웹 접근성 | Web Accessibility | 8 | 새 단어 |
| 프론트엔드 | 웹 성능 | Web Performance | 5 | 새 단어 |
| 프론트엔드 | 상태 관리 | State Management | 8 | O |
| 프론트엔드 | 디자인 시스템 | Design System | 14 | O |
| 프론트엔드 | 마이크로 프론트엔드 | Micro Frontends | 1 | O |
| 프론트엔드 | 모노레포 | Monorepo | 2 | O |
| 백엔드 | 배치 | Batch Processing | 15 | 새 단어 |
| 백엔드 | 동시성 | Concurrency | 15 | O |
| 백엔드 | 코루틴 | Coroutine | 3 | O |
| 백엔드 | 비동기 | Async | 32 | 새 단어 |
| 백엔드 | 캐시 | Cache | 31 | O |
| 데이터베이스 | 인덱스 | DB Index | 20 | 새 단어 |
| 데이터베이스 | 쿼리 최적화 | Query Optimization | 2 | O |
| 데이터베이스 | 트랜잭션 | Transaction | 19 | O |
| 데이터베이스 | 샤딩 | Sharding | 3 | O |
| 데이터 | 메시지 큐 | Message Queue | 9 | O |
| 데이터 | 검색 엔진 | Search Engine | 4 | O |
| 데이터 | 데이터 파이프라인 | Data Pipeline | 13 | O |
| 데이터 | 데이터 웨어하우스 | Data Warehouse | 0 | O |
| 데이터 | A/B 테스트 | A/B Testing | 2 | 새 단어 |
| 인프라 | 네트워크 | Network | 39 | O |
| 인프라 | 서비스 메시 | Service Mesh | 3 | O |
| 클라우드 | 서버리스 | Serverless | 11 | O |
| DevOps | 모니터링 | Monitoring | 30 | O |
| DevOps | 옵저버빌리티 | Observability | 15 | O |
| DevOps | 로깅 | Logging | 11 | O |
| 아키텍처 | 이벤트 기반 아키텍처 | Event-Driven Architecture | 3 | 새 단어 |
| 아키텍처 | 클린 아키텍처 | Clean Architecture | 4 | O |
| 아키텍처 | 디자인 패턴 | Design Pattern | 3 | O |
| 아키텍처 | 분산 시스템 | Distributed Systems | 3 | 새 단어 |
| 품질 | 테스트 | Testing | 135 | 새 단어 |
| 품질 | E2E 테스트 | E2E Testing | 8 | 새 단어 |
| 품질 | 리팩터링 | Refactoring | 6 | O |
| 품질 | 성능 최적화 | Performance Optimization | 11 | 새 단어 |
| 문화 | 애자일 | Agile | 6 | O |
| 문화 | 오픈소스 | Open Source | 31 | O |
| AI | 머신러닝 | Machine Learning | 28 | O |
| AI | 딥러닝 | Deep Learning | 1 | O |
| AI | AI 에이전트 | AI Agent | 100 | O |
| AI | 추천 시스템 | Recommender System | 3 | O |
| AI | 자연어 처리 | NLP | 0 | O |
| AI | 컴퓨터 비전 | Computer Vision | 0 | O |
| AI | 프롬프트 엔지니어링 | Prompt Engineering | 11 | O |
| AI | AI 코딩 도구 | AI Coding Tools | 52 | 새 단어 |
| 보안 | 보안 | Security | 147 | O |
| 보안 | 인증 | Authentication | 110 | O |
| 보안 | 암호화 | Cryptography | 19 | 새 단어 |

- pm 예시와 다르게 정한 것
  - `인덱스` → **`DB Index`** (`Index`는 `z-index`·일반 영어 "index"까지 잡음, 시뮬레이션에서 CSS 글 오탐 확인)
  - `배치` → **`Batch Processing`** (`Batch`는 무관한 글 2건 추가 태깅)
  - `성능 최적화` → **`Performance Optimization`** (`Performance`는 "High Performance" 같은 영어 제목 2건 오탐. `웹 성능`=`Web Performance`와도 구분됨)
  - `웹 접근성` → `Web Accessibility` (a11y는 동의어로 이미 있음)
  - `보안` → **`Security`** (분류 `Security`와 같은 이름. 분류명과 태그명은 서로 다른 목록이라 충돌 없음)
- 한글 유지 13: 데이터 분석, 결제, 핀테크, 커머스, 개발 문화, 회고, 채용, 컨퍼런스, 게임 서버, 개인정보, 대규모 트래픽, 기술 부채, 코드 리뷰
- 정리 대상 동의어: 새 이름과 같아지는 기존 동의어(예: `캐시`의 `Cache`)는 삭제하고 한글 이름을 동의어로 추가 → 이름·동의어 중복 없음 규칙 유지. 다른 태그 이름·동의어와 충돌 0건

#### 2. 태깅 영향 시뮬레이션 (`db/scripts/tag-rename-impact.py`, 운영 글 2,588건, 서버 `tagger.ts` 규칙 그대로 재태깅)
- 손실 0건 (모든 한글 이름이 동의어로 남음). "캐시"·"테스트"·"인증"은 매칭어 집합이 같아 태깅·검색 결과 동일
- 변화 8건, 전부 **추가 또는 순서 변경** (태그가 빠지는 글 0)
  | 원인 | 건수 | 내용 |
  |---|---|---|
  | `Async` 새 매칭어 | 5건 추가 | 영어 "async"가 있는 글 (`async fn`, `defer와 async`, Swift·Rust 비동기). 모두 맞는 태그 |
  | `DB Index` 새 매칭어 | 1건 추가 | "DB Index 입문" 글. 맞는 태그 |
  | `Cryptography`·`Testing` | 2건 순서만 변경 | 제목의 영어 단어가 한글보다 앞에 있어 순위 앞당겨짐. 태그 집합 같음 |
- 수용 기준 "재태깅 전후 태그 수 동일"과는 +6행 차이. **dba 권장: 허용** (손실 0이고 추가 6건 모두 정답 태그). 엄격 적용 원하면 `비동기`·`인덱스`를 한글 유지하면 변화 0 (순서 변경 2건만 남음) → pm 결정 요청
- 검색: 기존 글의 검색 토큰은 이미 한글 이름으로 저장돼 있어 그대로 검색됨. 새 글은 이름+동의어(한글 포함)로 토큰 생성 → "캐시" 검색 결과 동일

#### 3. 분류 값 변경 방식 (server와 확정 필요)
- dba 제안: **DB 값 자체를 영어로 변경** (`tags.category`). 표시 라벨 매핑을 두면 client·server·관리자 화면 세 곳에 매핑이 생기고 관리자 입력값과 표시값이 달라짐
  | 기존 | 변경 | | 기존 | 변경 |
  |---|---|---|---|---|
  | 언어 | Language | | 프론트엔드 | Frontend |
  | 백엔드 | Backend | | 데이터베이스 | Database |
  | 데이터 | Data | | AI | AI |
  | 인프라 | Infra | | DevOps | DevOps |
  | 아키텍처 | Architecture | | 품질 | Quality |
  | 보안 | Security | | 문화 | 문화 |
  | 모바일 | Mobile | | 클라우드 | Cloud |
  | 도메인 | Domain | | 디자인 | Design |
  - `문화`는 한글 유지. `기타`는 DB 값이 아니라 분류 NULL의 화면 라벨 (client)
- 영향: `GET /tags?category=` 값이 영어로 바뀜 (client S-12 분류 탭), server 분야 상수(`field → category[]`)
- 무중단 순서 제안
  1. server: 분야 상수에 한글·영어 값 **둘 다** 넣어 배포 (전환 중 분야 필터 공백 방지), 태그 사전·분야 캐시 무효화 경로 확인
  2. dba: 마이그레이션 `0011`(이름·분류·동의어 데이터 변경, down 포함) + `002_tags.sql` 시드 갱신 → `devfeed` 적용, 적용 직후 server에 캐시 무효화(또는 재시작) 요청
  3. server: 상수에서 한글 값 제거. client: 분류 라벨 영어 그대로 표시

#### 요청
- pm: 1번 목록(특히 `DB Index`·`Batch Processing`·`Performance Optimization`·`Security`)과 2번 "추가 6건 허용" 여부 결정
- server: 3번 방식·순서 동의 여부. 동의하면 1단계 배포 후 알려주기 바람. `0011`은 pm 확정 후 작성해 `devfeed_test`·`devfeed_perf`에서 up → down → up 검증 후 운영 적용
