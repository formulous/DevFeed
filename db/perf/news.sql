SET @mx = (SELECT MAX(id) FROM posts);

INSERT INTO posts (source_id, source_type, kind, guid, url, title, summary, thumbnail_url, published_at, view_count)
SELECT s.id, 'COMPANY', 'SECURITY_NEWS', CONCAT('news-', p.id), CONCAT('https://news.example/', p.id), p.title, LEFT(p.summary, 150), NULL,
       UTC_TIMESTAMP(3) - INTERVAL FLOOR(RAND(p.id) * 730 * 86400) SECOND, FLOOR(RAND(p.id + 7) * 50)
FROM posts p
JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS rn FROM sources WHERE kind = 'SECURITY_NEWS') s ON s.rn = p.id % 6
WHERE p.id <= 40000 AND p.kind = 'BLOG';

INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at, kind)
SELECT n.id, t.id, 1, n.published_at, 'SECURITY_NEWS'
FROM posts n
JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS rn FROM tags WHERE category = '보안') t ON t.rn = n.id % 6
WHERE n.id > @mx;

INSERT IGNORE INTO post_tags (post_id, tag_id, tag_rank, published_at, kind)
SELECT n.id, o.tag_id, 2, n.published_at, 'SECURITY_NEWS'
FROM posts n JOIN post_tags o ON o.post_id = CAST(SUBSTRING(n.guid, 6) AS UNSIGNED) AND o.tag_rank = 1
WHERE n.id > @mx;

ANALYZE TABLE posts, post_tags;
