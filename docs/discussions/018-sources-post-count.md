# 018. 공개 소스 목록에 글 수(postCount) 추가 요청

- 상태: decided
- 제기: client
- 관련: server, pm
- 관련 문서: `docs/discussions/017-filter-panel-redesign.md`, `docs/api/openapi.yaml` `GET /sources`·`SourceBrief`

## 배경
- 017 사이드바 재설계의 "글 많은 소스 5개 빠른 선택 칩"과 소스 선택 창(S-12)의 글 수 표시를 하려면 소스별 글 수가 필요함
- 지금 `GET /sources` 응답(`SourceBrief`)에는 `id, name, logoUrl, type`만 있음
- 017 "API·데이터" 항목: 글 수 정렬이 필요하면 server에 `postCount` 추가를 요청하기로 함 (사용자 확인 완료)

## 제안
- `GET /sources` 응답 항목에 `postCount: integer`(공개 피드에 보이는 그 소스 글 수) 추가
  - `SourceBrief`는 글 카드에도 쓰이므로 건드리지 않고, 목록 전용 스키마(예: `SourceListItem = SourceBrief + postCount`)로 분리하는 쪽을 제안
  - 태그 목록 `postCount`처럼 최대 10분 지연 허용 (캐시 가능)
  - 정렬은 지금처럼 이름순 유지해도 됨. client가 글 수로 정렬함
- 필드 추가라 호환 변경 (conventions 7절)

## 의견

### client (1차)
- client는 `postCount`가 있으면 사이드바에 글 수 상위 5개 소스를 빠른 선택 칩으로 보여주고, 선택 창에서 소스 칩에 글 수를 표시함
- 필드가 없을 때(지금)는 빠른 선택 칩을 숨기고 "전체 ›" 선택 창만 제공함. 그래서 배포 순서와 무관하게 동작함

### server (1차)
- 찬성. 명세는 client 제안대로 목록 전용 스키마로 분리함
  - `SourceListItem = SourceBrief + postCount`, `GET /sources` 응답 `items: SourceListItem[]`. 글 카드의 `source`(`SourceBrief`)는 그대로
  - `postCount`: 그 소스의 전체 글 수 (비활성 소스의 글도 피드에 남으므로 포함). 정렬은 지금처럼 이름순
- 구현: `SELECT source_id, COUNT(*) FROM posts GROUP BY source_id` (`idx_posts_source_published` 인덱스만 읽음)
  - 지금 `GET /sources` 캐시가 1분인데, 글 수 계산이 들어가므로 10분으로 늘림 (태그 `postCount`와 같은 지연 기준, client 제안과 일치)
  - 비용: 글 10만 건에서 인덱스 스캔 1회, 10분에 1번이라 부담 없음 (구현 후 `devfeed_perf`에서 측정해 기록)
- pm 결정 후 `openapi.yaml`을 먼저 고치고 구현함

## 결정 (pm)
- 결정 (2026-11-20): server 안 채택
  - `GET /sources` 응답을 목록 전용 `SourceListItem = SourceBrief + postCount`로 분리, 글 카드 `source`(`SourceBrief`)는 그대로
  - `postCount`: 소스 전체 글 수(비활성 소스 포함), 최대 10분 지연, 정렬은 이름순 유지(client가 글 수 정렬)
  - 필드 추가라 호환 변경. client는 필드 없을 때 빠른 선택 칩 숨김으로 배포 순서 무관
- 근거: 017 사이드바 "많이 쓰는 소스 5개" 빠른 선택에 필요, 비용은 10분에 인덱스 스캔 1회로 작음, 태그 `postCount`와 지연 기준 통일
- 후속 작업:
  - server - `openapi.yaml` 먼저 수정 → 구현 → `devfeed_perf` 측정 기록
  - client - 017 구현에 반영

### server (2차) — 반영 완료
- 명세: `openapi.yaml` `GET /sources` 응답 항목을 `SourceListItem`(`SourceBrief` + `postCount`)으로 변경. 글 카드 `source`는 `SourceBrief` 그대로
- 구현: `posts` `GROUP BY source_id` 합산, `GET /sources` 캐시 1분 → 10분
- 비용: `devfeed_perf` 글 10만 건에서 `idx_posts_source_published` 인덱스만 읽음(`Using index`), p50 8.2ms / p95 36.2ms. 10분에 1번
- e2e 1건 추가(글 4건 소스의 `postCount` 4, 기존 필드 유지), 전체 e2e 17건·단위 112건 통과
- `deploy.sh`로 반영, 공개 경로 `https://formulous.org/portfolio/api/sources`에서 36곳 `postCount` 확인

