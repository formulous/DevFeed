-- F-080 like on (PUT), one transaction: counter only when a row was inserted
START TRANSACTION;
INSERT IGNORE INTO post_likes (user_id, post_id) VALUES (@uid, @pid);
SET @n = ROW_COUNT();
UPDATE posts SET like_count = like_count + 1 WHERE id = @pid AND @n = 1;
COMMIT;

-- F-080 like off (DELETE)
START TRANSACTION;
DELETE FROM post_likes WHERE user_id = @uid AND post_id = @pid;
SET @n = ROW_COUNT();
UPDATE posts SET like_count = like_count - 1 WHERE id = @pid AND @n = 1;
COMMIT;

-- F-080 likedByMe for card ids
SELECT post_id FROM post_likes WHERE user_id = @uid AND post_id IN (1, 2, 3);

-- F-081 top-level comments, oldest first, cursor by id
SELECT c.id, c.user_id, c.body, c.status, c.reply_count, c.edited_at, c.created_at
FROM comments c
WHERE c.post_id = @pid AND c.parent_id IS NULL AND c.id > @after
ORDER BY c.id LIMIT 21;

-- F-081 first 3 replies per parent (+1 to know more), one query for the page
SELECT id, parent_id FROM (
  SELECT c.id, c.parent_id, ROW_NUMBER() OVER (PARTITION BY c.parent_id ORDER BY c.id) AS rn
  FROM comments c WHERE c.parent_id IN (10, 11, 12)
) r WHERE rn <= 4;

-- F-081 more replies
SELECT c.id FROM comments c WHERE c.parent_id = @parent AND c.id > @after ORDER BY c.id LIMIT 21;

-- F-081 create: parent is always top-level (server lifts reply-of-reply to its parent)
START TRANSACTION;
SELECT id FROM comments WHERE id = @parent AND post_id = @pid AND parent_id IS NULL AND status <> 'DELETED' FOR UPDATE;
INSERT INTO comments (post_id, parent_id, user_id, body) VALUES (@pid, @parent, @uid, @body);
UPDATE comments SET reply_count = reply_count + 1 WHERE id = @parent;
UPDATE posts SET comment_count = comment_count + 1 WHERE id = @pid;
COMMIT;

-- F-081 rate limit (last 1 minute / 24 hours)
SELECT SUM(created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE) AS last_minute, COUNT(*) AS last_day
FROM comments WHERE user_id = @uid AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 DAY;

-- F-081 delete, top-level with replies: keep placeholder
UPDATE comments SET status = 'DELETED', body = NULL, user_id = NULL, hidden_at = NULL, hidden_by = NULL
WHERE id = @cid AND reply_count > 0;

-- F-081 delete, no replies (or a reply): remove row; for a reply also decrement parent and drop an empty placeholder parent
DELETE FROM comments WHERE id = @cid AND reply_count = 0;
UPDATE comments SET reply_count = reply_count - 1 WHERE id = @parent;
DELETE FROM comments WHERE id = @parent AND status = 'DELETED' AND reply_count = 0;

-- F-081 commentCount: -1 only when the removed comment was VISIBLE
UPDATE posts SET comment_count = comment_count - 1 WHERE id = @pid;

-- F-081 admin hide / unhide (counter -1 / +1 only on actual change)
UPDATE comments SET status = 'HIDDEN', hidden_at = UTC_TIMESTAMP(3), hidden_by = @admin WHERE id = @cid AND status = 'VISIBLE';
UPDATE comments SET status = 'VISIBLE', hidden_at = NULL, hidden_by = NULL WHERE id = @cid AND status = 'HIDDEN';

-- F-032 withdrawal (before deleting users, same transaction as D-16)
UPDATE posts p JOIN post_likes l ON l.post_id = p.id SET p.like_count = p.like_count - 1 WHERE l.user_id = @uid;
DELETE FROM post_likes WHERE user_id = @uid;
UPDATE posts p JOIN (SELECT post_id, COUNT(*) n FROM comments WHERE user_id = @uid AND status = 'VISIBLE' GROUP BY post_id) c ON c.post_id = p.id
SET p.comment_count = p.comment_count - c.n;
CREATE TEMPORARY TABLE tmp_withdraw_parents AS
  SELECT parent_id, COUNT(*) AS n FROM comments WHERE user_id = @uid AND parent_id IS NOT NULL GROUP BY parent_id;
UPDATE comments par JOIN tmp_withdraw_parents r ON r.parent_id = par.id SET par.reply_count = par.reply_count - r.n;
DELETE FROM comments WHERE user_id = @uid AND parent_id IS NOT NULL;
UPDATE comments SET status = 'DELETED', body = NULL, user_id = NULL, hidden_at = NULL, hidden_by = NULL WHERE user_id = @uid AND reply_count > 0;
DELETE FROM comments WHERE user_id = @uid AND reply_count = 0;
DELETE par FROM comments par JOIN tmp_withdraw_parents r ON r.parent_id = par.id WHERE par.status = 'DELETED' AND par.reply_count = 0;
DROP TEMPORARY TABLE tmp_withdraw_parents;

-- 026 consistency check: every column must be 0
SELECT
  (SELECT COUNT(*) FROM posts p LEFT JOIN (SELECT post_id, COUNT(*) n FROM post_likes GROUP BY post_id) l ON l.post_id = p.id
    WHERE p.like_count <> IFNULL(l.n, 0)) AS like_count_mismatch,
  (SELECT COUNT(*) FROM posts p LEFT JOIN (SELECT post_id, COUNT(*) n FROM comments WHERE status = 'VISIBLE' GROUP BY post_id) c ON c.post_id = p.id
    WHERE p.comment_count <> IFNULL(c.n, 0)) AS comment_count_mismatch,
  (SELECT COUNT(*) FROM comments par LEFT JOIN (SELECT parent_id, COUNT(*) n FROM comments WHERE parent_id IS NOT NULL GROUP BY parent_id) r ON r.parent_id = par.id
    WHERE par.parent_id IS NULL AND par.reply_count <> IFNULL(r.n, 0)) AS reply_count_mismatch,
  (SELECT COUNT(*) FROM comments ch JOIN comments par ON par.id = ch.parent_id WHERE par.parent_id IS NOT NULL OR par.post_id <> ch.post_id) AS bad_reply_tree,
  (SELECT COUNT(*) FROM comments WHERE status = 'DELETED' AND reply_count = 0) AS empty_placeholder,
  (SELECT COUNT(*) FROM comments WHERE parent_id IS NOT NULL AND status = 'DELETED') AS deleted_reply_row;
