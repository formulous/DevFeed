SET @umin = (SELECT MIN(id) FROM users), @ucnt = (SELECT COUNT(*) FROM users), @pmax = (SELECT MAX(id) FROM posts);

INSERT IGNORE INTO post_likes (user_id, post_id, created_at)
SELECT @umin + (s.seq % @ucnt), 1 + FLOOR(POW(RAND(s.seq), 3) * @pmax), UTC_TIMESTAMP(3) - INTERVAL (s.seq % 300) DAY
FROM seq_1_to_500000 s;

INSERT INTO comments (post_id, user_id, body, created_at)
SELECT IF(s.seq <= 2000, @pmax - 1, 1 + FLOOR(POW(RAND(s.seq + 11), 3) * @pmax)), @umin + ((s.seq * 7) % @ucnt),
       CONCAT('합성 댓글 ', s.seq, ' <script>alert(1)</script>'), UTC_TIMESTAMP(3) - INTERVAL (s.seq % 300) DAY
FROM seq_1_to_100000 s;

SET @cmax = (SELECT MAX(id) FROM comments), @cmin = (SELECT MIN(id) FROM comments);
INSERT INTO comments (post_id, parent_id, user_id, body, created_at)
SELECT c.post_id, c.id, @umin + ((s.seq * 13) % @ucnt), CONCAT('합성 답글 ', s.seq), c.created_at + INTERVAL 1 HOUR
FROM seq_1_to_50000 s JOIN comments c ON c.id = @cmin + IF(s.seq <= 600, (s.seq % 30), FLOOR(RAND(s.seq + 5) * (@cmax - @cmin)));

UPDATE comments SET status = 'HIDDEN', hidden_at = UTC_TIMESTAMP(3) WHERE id % 97 = 0;

UPDATE comments p JOIN (SELECT parent_id, COUNT(*) n FROM comments WHERE parent_id IS NOT NULL GROUP BY parent_id) r ON r.parent_id = p.id
SET p.reply_count = r.n;

UPDATE posts p
LEFT JOIN (SELECT post_id, COUNT(*) n FROM post_likes GROUP BY post_id) l ON l.post_id = p.id
LEFT JOIN (SELECT post_id, COUNT(*) n FROM comments WHERE status = 'VISIBLE' GROUP BY post_id) c ON c.post_id = p.id
SET p.like_count = IFNULL(l.n, 0), p.comment_count = IFNULL(c.n, 0);

ANALYZE TABLE post_likes, comments, posts;
