-- lock order (026/029 extended): users rows FOR UPDATE in ascending id (actor and target author) -> posts -> community_posts
--   -> parent comment -> comment -> report_targets -> score_events
-- day boundary KST midnight, server passes @day_start_utc

-- F-090 write limits (users row locked first; admins skip): account age 24h, 5 posts per KST day, 60s gap
SELECT created_at, role FROM users WHERE id = @uid FOR UPDATE;
SELECT COUNT(*) AS today FROM score_events WHERE user_id = @uid AND kind = 'POST_WRITE' AND created_at >= @day_start_utc;
SELECT MAX(created_at) AS last_at FROM score_events WHERE user_id = @uid AND kind = 'POST_WRITE';

-- F-090 create: posts row (temporary unique url, then canonical) + extension + tags + POST_WRITE (+10 for first 3 per day)
INSERT INTO posts (source_id, source_type, kind, url, title, summary, published_at)
SELECT id, 'PERSONAL', 'COMMUNITY', CONCAT('internal:community:', UUID()), @title, @excerpt, UTC_TIMESTAMP(3) FROM sources WHERE feed_url = 'internal:community';
SET @pid = LAST_INSERT_ID();
UPDATE posts SET url = CONCAT(@base_url, '/community/posts/', @pid) WHERE id = @pid;
INSERT INTO community_posts (post_id, user_id, category, body, published_at) SELECT @pid, @uid, @category, @body, published_at FROM posts WHERE id = @pid;
INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at, kind) SELECT @pid, @tag, 1, published_at, 'COMMUNITY' FROM posts WHERE id = @pid;
SELECT COUNT(*) INTO @today FROM score_events WHERE user_id = @uid AND kind = 'POST_WRITE' AND created_at >= @day_start_utc;
INSERT INTO score_events (user_id, kind, ref_id, points) VALUES (@uid, 'POST_WRITE', @pid, IF(@today < 3, 10, 0));
UPDATE users SET score = score + 10 WHERE id = @uid AND @today < 3;

-- F-090 list (VISIBLE only; HIDDEN and DELETED never listed), cursor (published_at, post_id)
SELECT cp.post_id FROM community_posts cp
WHERE cp.status = 'VISIBLE' AND cp.category = @category
  AND (cp.published_at < @c_at OR (cp.published_at = @c_at AND cp.post_id < @c_id))
ORDER BY cp.published_at DESC, cp.post_id DESC LIMIT 21;

-- F-090 popular: likes x2 + comments + views x0.1, period by published_at
SELECT p.id, p.like_count * 2 + p.comment_count + p.view_count * 0.1 AS score
FROM community_posts cp JOIN posts p ON p.id = cp.post_id
WHERE cp.status = 'VISIBLE' AND cp.published_at >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY
ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20;

-- F-093 like on a community post: after the 026 like insert affected 1 row and liker <> author, +1 to author (50 per KST day, over the cap no row)
SELECT COALESCE(SUM(points), 0) INTO @today FROM score_events WHERE user_id = @author AND kind = 'LIKE_RECEIVED' AND created_at >= @day_start_utc;
INSERT IGNORE INTO score_events (user_id, kind, ref_id, actor_id, points)
SELECT @author, 'LIKE_RECEIVED', @pid, @uid, 1 FROM DUAL WHERE @today < 50 AND @author <> @uid;
SET @n = ROW_COUNT();
UPDATE users SET score = score + 1 WHERE id = @author AND @n = 1;

-- F-093 like off: revoke the author's point if it was granted
DELETE FROM score_events WHERE user_id = @author AND kind = 'LIKE_RECEIVED' AND ref_id = @pid AND actor_id = @uid;
SET @n = ROW_COUNT();
UPDATE users SET score = score - 1 WHERE id = @author AND @n = 1;

-- F-091 accept: own QUESTION, top-level VISIBLE comment by someone else on the same post (checked under the posts/community_posts lock)
UPDATE community_posts cp JOIN comments c ON c.id = @cid
SET cp.accepted_comment_id = c.id
WHERE cp.post_id = @pid AND cp.user_id = @uid AND cp.category = 'QUESTION' AND cp.status = 'VISIBLE'
  AND c.post_id = cp.post_id AND c.parent_id IS NULL AND c.status = 'VISIBLE' AND c.user_id <> cp.user_id;
UPDATE community_posts SET accepted_comment_id = NULL WHERE post_id = @pid AND user_id = @uid;

-- F-090 delete (author or admin) / withdrawal: always soft delete (row stays so likes, comments, bookmarks, reads and other users' score rows stay valid)
UPDATE community_posts SET status = 'DELETED', body = NULL, user_id = NULL, accepted_comment_id = NULL,
  hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL WHERE post_id = @pid;
UPDATE posts SET title = '', summary = NULL WHERE id = @pid;
DELETE FROM post_tags WHERE post_id = @pid;
UPDATE score_events SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = @author AND kind = 'POST_WRITE' AND ref_id = @pid AND revoked_at IS NULL;

-- F-092 report: target row first (upsert), then report; 3 distinct reporters -> auto hide unless CLEARED
INSERT INTO report_targets (target_type, target_id) VALUES (@type, @tid) ON DUPLICATE KEY UPDATE target_id = target_id;
SELECT report_count, state FROM report_targets WHERE target_type = @type AND target_id = @tid FOR UPDATE;
INSERT IGNORE INTO reports (target_type, target_id, reporter_id, reason, detail) VALUES (@type, @tid, @uid, @reason, @detail);
SET @n = ROW_COUNT();
UPDATE report_targets SET report_count = report_count + 1, last_reported_at = UTC_TIMESTAMP(3),
  state = IF(state = 'PENDING' AND report_count + 1 >= 3, 'HIDDEN', state)
WHERE target_type = @type AND target_id = @tid AND @n = 1;
UPDATE community_posts SET status = 'HIDDEN', hidden_at = UTC_TIMESTAMP(3), hidden_reason = 'REPORTS'
WHERE @type = 'POST' AND post_id = @tid AND status = 'VISIBLE'
  AND EXISTS (SELECT 1 FROM report_targets WHERE target_type = 'POST' AND target_id = @tid AND state = 'HIDDEN');

-- F-092 auto hide of a comment: same as admin hide (026) with hidden_reason REPORTS: comment_count -1, COMMENT score revoked, accepted answer released
UPDATE comments SET status = 'HIDDEN', hidden_at = UTC_TIMESTAMP(3), hidden_reason = 'REPORTS'
WHERE @type = 'COMMENT' AND id = @tid AND status = 'VISIBLE'
  AND EXISTS (SELECT 1 FROM report_targets WHERE target_type = 'COMMENT' AND target_id = @tid AND state = 'HIDDEN');
UPDATE community_posts SET accepted_comment_id = NULL WHERE accepted_comment_id = @tid AND @type = 'COMMENT';

-- F-092 admin queue and resolution
SELECT rt.target_type, rt.target_id, rt.report_count, rt.state, rt.last_reported_at
FROM report_targets rt WHERE rt.state IN ('PENDING', 'HIDDEN') ORDER BY rt.last_reported_at DESC LIMIT 21;
SELECT target_type, target_id, reason, COUNT(*) AS n FROM reports
WHERE (target_type, target_id) IN (('POST', 1), ('COMMENT', 2)) GROUP BY target_type, target_id, reason;
UPDATE report_targets SET state = 'CLEARED', resolved_at = UTC_TIMESTAMP(3), resolved_by = @admin WHERE target_type = @type AND target_id = @tid;

-- 032 consistency check: every column must be 0
SELECT
  (SELECT COUNT(*) FROM posts p LEFT JOIN community_posts cp ON cp.post_id = p.id WHERE p.kind = 'COMMUNITY' AND cp.post_id IS NULL) AS community_without_extension,
  (SELECT COUNT(*) FROM community_posts cp JOIN posts p ON p.id = cp.post_id WHERE p.kind <> 'COMMUNITY') AS extension_wrong_kind,
  (SELECT COUNT(*) FROM community_posts cp JOIN comments c ON c.id = cp.accepted_comment_id
    WHERE cp.category <> 'QUESTION' OR c.post_id <> cp.post_id OR c.parent_id IS NOT NULL OR c.status <> 'VISIBLE' OR c.user_id = cp.user_id) AS bad_accept,
  (SELECT COUNT(*) FROM report_targets rt LEFT JOIN (SELECT target_type, target_id, COUNT(*) n FROM reports GROUP BY target_type, target_id) r
    ON r.target_type = rt.target_type AND r.target_id = rt.target_id WHERE rt.report_count <> IFNULL(r.n, 0)) AS report_count_mismatch,
  (SELECT COUNT(*) FROM score_events e JOIN community_posts cp ON cp.post_id = e.ref_id
    WHERE e.kind = 'POST_WRITE' AND (cp.status = 'VISIBLE') <> (e.revoked_at IS NULL)) AS post_write_revoke_mismatch,
  (SELECT COUNT(*) FROM score_events e LEFT JOIN post_likes l ON l.user_id = e.actor_id AND l.post_id = e.ref_id
    WHERE e.kind = 'LIKE_RECEIVED' AND l.user_id IS NULL) AS like_received_without_like,
  (SELECT COUNT(*) FROM posts WHERE kind = 'COMMUNITY' AND id IN (SELECT post_id FROM post_search)) AS community_in_search;
