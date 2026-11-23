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

## HTML 화면 경로 (S3~S7)
nginx가 정적 파일이 아닌 HTML 요청(GET·HEAD)을 server로 넘김. `/api/`·`/sitemap*.xml`·`/community/rss.xml` 밖이고 마지막 경로 칸에 `.`이 없는 경로가 대상. 봇·사람 구분 없이 같은 HTML (User-Agent 안 봄)

### 틀과 경로 표
- 틀 `WEB_DIST_DIR/index.html`(기본 `../client/dist-root`), 경로 표 `WEB_DIST_DIR/routes.json` (client 소유, 형식은 044 client 구현 기록)
- 두 파일은 수정 시각이 바뀌면 다시 읽음(확인 간격 최대 2초). 읽기·파싱 실패면 마지막 정상 값 계속 씀
- 틀에 `<!--seo:head-->`…`<!--/seo:head-->`와 `<!--seo:body-->`가 각각 한 번씩 없으면 주입 없이 틀 그대로 200. 경로 표가 없으면 머리말만 기본값, 404 판정 안 함 (지금 화면 유지가 우선)
- 경로 매칭: 쿼리 뺀 경로, 끝 `/` 하나는 무시, 정확히 일치·앞 항목 우선, `:param` = 경로 한 칸

### 응답
- 상태: 경로 표에 있으면 200, 없으면 404(`notFound` 머리말). 글 상세는 아래 404 규칙
- `Content-Type: text/html; charset=utf-8`, `Cache-Control: public, max-age=60`. server 메모리 캐시 5분(글 수정·숨김·삭제 반영 최대 5분 지연)
- 머리말 구간은 아래 태그로 통째로 바꿈. 모든 값 HTML 이스케이프
  - `title`, `description`, `robots`, `og:type`(글 상세 `article`, 그 외 `website`), `og:title`, `og:description`, `twitter:title`, `twitter:description` (`data-seo` 키는 틀과 같음)
  - `canonical`이 빈 값이 아니면 `<link rel="canonical" data-seo="canonical">`·`og:url`(`data-seo="og:url"`) = `origin` + canonical 패턴(`:param`은 요청 값)
  - 글 상세만 추가: `article:published_time`·`article:modified_time`(수정 시)·`article:author`, JSON-LD `<script type="application/ld+json" data-seo="jsonld">`, `<script type="application/json" id="seo-data" data-seo="seo-data">`

### 글 상세 `/community/posts/:id` (S3·S4·S5)
- `:id`가 숫자가 아니거나 글이 없거나 `HIDDEN`·`DELETED`면 404 + `notFound` 머리말(title `글을 찾을 수 없어요 · formulous`), 본문 비움
- 머리말: title `<글 제목> · <siteName>`, description = `summary`(없으면 본문 평문) 앞 120자, robots·canonical은 경로 표 값
- 본문 (`#root` 안, 스타일 없음, React가 마운트 때 교체)
  - `<article>`: `<h1>` 제목, 말머리, 작성자 닉네임(탈퇴면 `탈퇴한 사용자`), `<time datetime>` 작성일, 본문 HTML, 태그
  - 본문 HTML: 마크다운 → HTML → 무해화. 허용 태그·규칙은 client `Markdown.tsx`와 같음 (`p h2 h3 h4 strong em del ul ol li blockquote table thead tbody tr th td a code pre span hr br`, h1→h2·h5/h6→h4, 이미지 → `[이미지: alt]` 글자, 링크는 `http(s)`만 `rel="nofollow ugc noopener noreferrer"`, 원문 HTML은 글자로 보임)
  - 댓글 `<ol>`: 채택 댓글 + 최상위 `VISIBLE` 댓글 오래된 순 최대 20개 (답글 제외). 댓글은 평문이라 이스케이프만
- JSON-LD (S5): `QUESTION` + 채택 있음 → `QAPage`(`mainEntity` `Question`: `name`·`text`·`answerCount`·`dateCreated`·`author`, `acceptedAnswer`, 나머지 넣은 댓글 `suggestedAnswer`), 그 외 → `DiscussionForumPosting`(`headline`·`text`·`url`·`datePublished`·`dateModified`·`author`·`commentCount`·`interactionStatistic` 좋아요, `comment` 넣은 댓글). `text`는 마크다운 제거 평문 앞 2,000자
- `seo-data`: `GET /api/community/posts/{id}` 비로그인 응답과 같은 JSON (`likedByMe` 등은 비로그인 값)
- JSON을 `<script>`에 넣을 때 `<`·`>`·`&`·U+2028·U+2029를 `\uXXXX`로 바꿈

### 목록 `/community` (S7)
- 본문: `<h1>` 경로 표 title, 공개 글 최신 20건 `<ul>` (제목 링크 `/community/posts/{id}` + 요약). 그 외 경로는 머리말만, 본문 비움
