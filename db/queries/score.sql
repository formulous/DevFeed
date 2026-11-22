-- lock order for every scored write: users row FOR UPDATE -> posts row FOR UPDATE -> parent comment -> comment -> score_events
-- day boundary: KST midnight; server passes @day_start_utc = (KST today 00:00) in UTC

-- F-083 read (+1, first read of a post only, 30 points per KST day; over the cap no row, so the post can earn on a later day)
START TRANSACTION;
SELECT score FROM users WHERE id = @uid FOR UPDATE;
SELECT COUNT(*) INTO @today FROM score_events
WHERE user_id = @uid AND kind = 'READ' AND created_at >= @day_start_utc;
INSERT IGNORE INTO score_events (user_id, kind, ref_id, points)
SELECT @uid, 'READ', @pid, 1 FROM DUAL WHERE @today < 30;
SET @n = ROW_COUNT();
UPDATE users SET score = score + 1 WHERE id = @uid AND @n = 1;
COMMIT;

-- F-083 like on (+2, no daily cap), inside the 026 like transaction after users and posts locks
INSERT IGNORE INTO score_events (user_id, kind, ref_id, points) VALUES (@uid, 'LIKE', @pid, 2);
SET @n = ROW_COUNT();
UPDATE users SET score = score + 2 WHERE id = @uid AND @n = 1;

-- F-083 like off: delete the row and take points back (re-like earns again, net stays 2)
DELETE FROM score_events WHERE user_id = @uid AND kind = 'LIKE' AND ref_id = @pid;
SET @n = ROW_COUNT();
UPDATE users SET score = score - 2 WHERE id = @uid AND @n = 1;

-- F-083 comment created (+5, first 10 comments per KST day; revoked rows still count, 11th+ keeps a 0-point row)
SELECT COUNT(*) INTO @today FROM score_events
WHERE user_id = @uid AND kind = 'COMMENT' AND created_at >= @day_start_utc;
INSERT INTO score_events (user_id, kind, ref_id, points) VALUES (@uid, 'COMMENT', @cid, IF(@today < 10, 5, 0));
UPDATE users SET score = score + 5 WHERE id = @uid AND @today < 10;

-- F-083 comment deleted by author / hidden by admin: revoke (lock the author users row first)
SELECT points INTO @p FROM score_events WHERE user_id = @author AND kind = 'COMMENT' AND ref_id = @cid AND revoked_at IS NULL FOR UPDATE;
UPDATE score_events SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = @author AND kind = 'COMMENT' AND ref_id = @cid AND revoked_at IS NULL;
SET @n = ROW_COUNT();
UPDATE users SET score = score - @p WHERE id = @author AND @n = 1;

-- F-083 unhide: restore
SELECT points INTO @p FROM score_events WHERE user_id = @author AND kind = 'COMMENT' AND ref_id = @cid AND revoked_at IS NOT NULL FOR UPDATE;
UPDATE score_events SET revoked_at = NULL WHERE user_id = @author AND kind = 'COMMENT' AND ref_id = @cid AND revoked_at IS NOT NULL;
SET @n = ROW_COUNT();
UPDATE users SET score = score + @p WHERE id = @author AND @n = 1;

-- F-082 profile (one request): score + 4 stats, all user-prefix ranges
SELECT u.nickname, u.score,
  (SELECT COUNT(*) FROM post_likes WHERE user_id = u.id) AS like_count,
  (SELECT COUNT(*) FROM comments WHERE user_id = u.id AND status = 'VISIBLE') AS comment_count,
  (SELECT COUNT(*) FROM read_histories WHERE user_id = u.id) AS read_count,
  (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id) AS bookmark_count
FROM users u WHERE u.id = @uid;

-- F-083 backfill (run once right after server starts writing events): no daily cap, idempotent
INSERT IGNORE INTO score_events (user_id, kind, ref_id, points, created_at)
SELECT user_id, 'READ', post_id, 1, first_read_at FROM read_histories;
INSERT IGNORE INTO score_events (user_id, kind, ref_id, points, created_at)
SELECT user_id, 'LIKE', post_id, 2, created_at FROM post_likes;
INSERT IGNORE INTO score_events (user_id, kind, ref_id, points, created_at, revoked_at)
SELECT user_id, 'COMMENT', id, 5, created_at, IF(status = 'HIDDEN', hidden_at, NULL) FROM comments WHERE status IN ('VISIBLE', 'HIDDEN');
UPDATE users u LEFT JOIN (SELECT user_id, SUM(points) s FROM score_events WHERE revoked_at IS NULL GROUP BY user_id) e ON e.user_id = u.id
SET u.score = IFNULL(e.s, 0);

-- retention (proposal): fold READ rows older than 1 year into one ARCHIVE row per user; score unchanged
INSERT INTO score_events (user_id, kind, ref_id, points)
SELECT user_id, 'ARCHIVE', 0, SUM(points) FROM score_events
WHERE kind = 'READ' AND created_at < UTC_TIMESTAMP(3) - INTERVAL 1 YEAR GROUP BY user_id HAVING SUM(points) > 0
ON DUPLICATE KEY UPDATE points = points + VALUES(points);
DELETE FROM score_events WHERE kind = 'READ' AND created_at < UTC_TIMESTAMP(3) - INTERVAL 1 YEAR;

-- 029 consistency check: every column must be 0
SELECT
  (SELECT COUNT(*) FROM users u LEFT JOIN (SELECT user_id, SUM(points) s FROM score_events WHERE revoked_at IS NULL GROUP BY user_id) e ON e.user_id = u.id
    WHERE u.score <> IFNULL(e.s, 0)) AS score_mismatch,
  (SELECT COUNT(*) FROM post_likes l LEFT JOIN score_events e ON e.user_id = l.user_id AND e.kind = 'LIKE' AND e.ref_id = l.post_id WHERE e.user_id IS NULL) AS like_without_event,
  (SELECT COUNT(*) FROM score_events e LEFT JOIN post_likes l ON l.user_id = e.user_id AND l.post_id = e.ref_id WHERE e.kind = 'LIKE' AND l.user_id IS NULL) AS event_without_like,
  (SELECT COUNT(*) FROM comments c JOIN score_events e ON e.user_id = c.user_id AND e.kind = 'COMMENT' AND e.ref_id = c.id
    WHERE (c.status = 'VISIBLE') <> (e.revoked_at IS NULL)) AS comment_revoke_mismatch,
  (SELECT COUNT(*) FROM score_events e LEFT JOIN comments c ON c.id = e.ref_id AND c.user_id = e.user_id
    WHERE e.kind = 'COMMENT' AND c.id IS NULL AND e.revoked_at IS NULL) AS deleted_comment_not_revoked,
  (SELECT COUNT(*) FROM comments c LEFT JOIN score_events e ON e.user_id = c.user_id AND e.kind = 'COMMENT' AND e.ref_id = c.id
    WHERE c.user_id IS NOT NULL AND e.user_id IS NULL) AS comment_without_event;
