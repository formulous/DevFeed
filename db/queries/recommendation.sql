-- F-042 step 1: tag preference (interest fixed weight + 30d read/bookmark tags with time decay)
SELECT pref.tag_id, SUM(pref.w) AS weight, MAX(pref.src) AS reason_src
FROM (
  SELECT uit.tag_id, 3.0 AS w, 3 AS src FROM user_interest_tags uit WHERE uit.user_id = @uid
  UNION ALL
  SELECT pt.tag_id, 2.0 * EXP(-TIMESTAMPDIFF(HOUR, b.created_at, UTC_TIMESTAMP(3)) / 24 / 14), 2
  FROM bookmarks b JOIN post_tags pt ON pt.post_id = b.post_id
  WHERE b.user_id = @uid AND b.created_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY
  UNION ALL
  SELECT pt.tag_id, 1.0 * EXP(-TIMESTAMPDIFF(HOUR, r.last_read_at, UTC_TIMESTAMP(3)) / 24 / 14), 1
  FROM read_histories r JOIN post_tags pt ON pt.post_id = r.post_id
  WHERE r.user_id = @uid AND r.last_read_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY
) pref
GROUP BY pref.tag_id
ORDER BY weight DESC
LIMIT 30;

-- F-042 step 2: candidates = last 14 days posts with preferred tags, not read, scored
SELECT pt.post_id, SUM(tw.weight) AS tag_score, p.view_count, p.published_at, p.source_id
FROM tmp_tag_weights tw
JOIN post_tags pt ON pt.tag_id = tw.tag_id AND pt.published_at >= UTC_TIMESTAMP(3) - INTERVAL 14 DAY
JOIN posts p ON p.id = pt.post_id
WHERE NOT EXISTS (SELECT 1 FROM read_histories r WHERE r.user_id = @uid AND r.post_id = pt.post_id)
GROUP BY pt.post_id, p.view_count, p.published_at, p.source_id
ORDER BY tag_score DESC
LIMIT 500;

-- F-042 impressions: one response = one request_id, batch insert
INSERT INTO recommendation_impressions (request_id, user_id, post_id, algorithm, position, reason, shown_at)
VALUES (@rid, @uid, 1, 'TAG_V1', 1, 'interest:Kafka', UTC_TIMESTAMP(3));

-- F-042 click attribution (POST /posts/{id}/views with recommendationId), first click only
UPDATE recommendation_impressions SET clicked_at = UTC_TIMESTAMP(3)
WHERE request_id = @rid AND post_id = @pid AND clicked_at IS NULL;

-- F-042 CTR by algorithm and day
SELECT stat_date, algorithm, impression_count, click_count, click_count / NULLIF(impression_count, 0) AS ctr
FROM recommendation_daily_stats WHERE stat_date >= CURRENT_DATE - INTERVAL 30 DAY ORDER BY stat_date, algorithm;
