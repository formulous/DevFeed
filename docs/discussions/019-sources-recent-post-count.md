# 019. 빠른 선택 소스 기준을 최근 글 수로 변경

- 상태: decided
- 제기: pm (사용자 요청)
- 관련: server, client
- 관련 문서: `docs/discussions/017`, `docs/discussions/018`, `docs/api/openapi.yaml` `SourceListItem`

## 배경
- 018 반영 후 전체 글 수(`postCount`) 상위 소스: 개인 블로그 1곳이 1,051건으로 압도적 (2위 252건)
- 017 사이드바 "글 많은 소스 5개" 빠른 선택이 전체 글 수 기준이면 과거 글이 많은 소스가 늘 상위를 차지해 지금 활발한 소스를 보여주지 못함
- 사용자 결정 (2026-11-20): 빠른 선택은 **최근 글 수** 기준

## 결정 (pm)
- `SourceListItem`에 `recentPostCount: integer` 추가 = 최근 30일(롤링, `published_at` 기준) 발행 글 수
  - 기간 30일: 인기 글 최장 기간(004, 30일)과 맞춤. 주 1회 미만 쓰는 블로그도 잡히는 길이
  - 기존 `postCount`(전체 글 수)는 유지. 선택 창(S-12)의 소스 칩 글 수 표시는 `postCount`
  - 최대 10분 지연 허용 (018 캐시와 같은 주기)
- client 사이드바 빠른 선택 5개: `recentPostCount` 내림차순, 동점은 `postCount` 내림차순, 그다음 이름순. `recentPostCount`가 0인 소스는 빠른 선택에서 제외
- 필드 추가라 호환 변경. client는 필드가 없으면 `postCount` 기준으로 동작

## 후속 작업
- server - `openapi.yaml` `SourceListItem.recentPostCount` 추가 → 구현(`idx_posts_source_published` 30일 범위 집계) → 배포
- client - 017 빠른 선택 정렬 기준 변경
- pm - `03-screens.md` S-01 사이드바 문구 "많이 쓰는 소스" → "최근 활발한 소스 5개" (완료)
