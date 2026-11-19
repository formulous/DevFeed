-- F-040 bookmark list, cursor (created_at DESC, post_id DESC)
SELECT b.post_id, b.created_at FROM bookmarks b
WHERE b.user_id = @uid AND (b.created_at < @c_at OR (b.created_at = @c_at AND b.post_id < @c_id))
ORDER BY b.created_at DESC, b.post_id DESC LIMIT 21;

-- F-040 bookmark list + tag filter
SELECT b.post_id, b.created_at FROM bookmarks b
WHERE b.user_id = @uid AND (b.created_at < @c_at OR (b.created_at = @c_at AND b.post_id < @c_id))
  AND EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = b.post_id AND pt.tag_id IN (28, 72))
ORDER BY b.created_at DESC, b.post_id DESC LIMIT 21;

-- F-040 bookmark count (5,000 limit)
SELECT COUNT(*) FROM bookmarks WHERE user_id = @uid;

-- F-041 read history list, cursor (last_read_at DESC, post_id DESC)
SELECT r.post_id, r.last_read_at FROM read_histories r
WHERE r.user_id = @uid AND (r.last_read_at < @c_at OR (r.last_read_at = @c_at AND r.post_id < @c_id))
ORDER BY r.last_read_at DESC, r.post_id DESC LIMIT 21;

-- F-041 read upsert
INSERT INTO read_histories (user_id, post_id, first_read_at, last_read_at) VALUES (@uid, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE last_read_at = VALUES(last_read_at);

-- F-041 delete all history
DELETE FROM read_histories WHERE user_id = @uid;

-- F-041 retention batch (1 year)
DELETE FROM read_histories WHERE last_read_at < UTC_TIMESTAMP(3) - INTERVAL 1 YEAR LIMIT 1000;
