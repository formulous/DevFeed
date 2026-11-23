# 웹 경로 명세 (`/api` 밖, 044)

검색엔진용 경로. server가 응답하고 nginx가 해당 경로만 server로 넘김. JSON API 규칙(`conventions.md`)을 따르지 않음.

## 공통
- 주소는 모두 `WEB_BASE_URL`(운영 `https://formulous.org`) 기준 절대 URL
- `Cache-Control: public, max-age=600`. server 메모리 캐시 10분 (글 작성·숨김·삭제 반영 최대 10분 지연)
- 요청 횟수 제한 없음 (캐시 응답)
- 대상 글: 자유 게시판 `community_posts.status = 'VISIBLE'`만. 숨김·삭제 글 제외

## `GET /sitemap.xml` (S1)
- `Content-Type: application/xml; charset=utf-8`
- 고정 화면: `/tech`, `/security`, `/community`, `/privacy` (정렬 화면은 canonical이 기본 목록이라 제외, pm 결정)
- 글: `/community/posts/{id}`, `lastmod` = `edited_at`이 있으면 그 값, 없으면 `published_at` (UTC ISO 8601)
- 고정 화면 + 글이 50,000건 이하면 `<urlset>` 하나. 넘으면 `<sitemapindex>`로 바꾸고 `/sitemap-{n}.xml`(n = 1부터, 각 50,000건 이하, 1번에 고정 화면 포함)을 나열함
- `GET /sitemap-{n}.xml`: 분할 파일. 범위 밖 n은 404

## `GET /community/rss.xml` (S2)
- `Content-Type: application/rss+xml; charset=utf-8`, RSS 2.0
- 채널: title `formulous 자유 게시판`, link `/community`, `atom:link rel="self"`, `language` `ko`
- 항목: 최근 발행 50건 (`published_at` 내림차순, 같으면 id 내림차순)
  - `title` 글 제목, `link`·`guid`(isPermaLink) `/community/posts/{id}`, `description` 목록 요약(`posts.summary`, 마크다운 제거 200자), `pubDate` RFC 822, `dc:creator` 작성자 닉네임, `category` 말머리 이름
- 모든 문자열 XML 이스케이프 (`& < > " '`), XML에 쓸 수 없는 제어 문자는 제거
