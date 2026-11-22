SET @src = (SELECT id FROM sources WHERE feed_url = 'internal:community'), @umin = (SELECT MIN(id) FROM users), @ucnt = (SELECT COUNT(*) FROM users);

INSERT INTO posts (source_id, source_type, kind, url, title, summary, published_at, view_count, like_count, comment_count)
SELECT @src, 'PERSONAL', 'COMMUNITY', CONCAT('https://formulous.org/dev-feed/community/posts/perf-', s.seq), CONCAT('커뮤니티 글 ', s.seq), '요약 두 줄',
       UTC_TIMESTAMP(3) - INTERVAL (s.seq * 1573) SECOND, FLOOR(RAND(s.seq) * 300), FLOOR(RAND(s.seq + 1) * 30), FLOOR(RAND(s.seq + 2) * 15)
FROM seq_1_to_20000 s;

INSERT INTO community_posts (post_id, user_id, category, body, status, published_at, created_at, hidden_at, hidden_reason)
SELECT p.id, @umin + (p.id % @ucnt), ELT(1 + p.id % 3, 'QUESTION', 'DISCUSSION', 'SHARE'), REPEAT('본문 ', 200 + p.id % 800),
       IF(p.id % 50 = 0, 'HIDDEN', 'VISIBLE'), p.published_at, p.published_at, IF(p.id % 50 = 0, p.published_at, NULL), IF(p.id % 50 = 0, 'REPORTS', NULL)
FROM posts p WHERE p.kind = 'COMMUNITY' AND p.url LIKE '%/perf-%';

ANALYZE TABLE posts, community_posts;
