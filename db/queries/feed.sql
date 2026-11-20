-- F-010 latest feed, first page
SELECT p.id, p.published_at FROM posts p
WHERE p.kind = 'BLOG'
ORDER BY p.published_at DESC, p.id DESC LIMIT 21;

-- F-010 latest feed, next page
SELECT p.id, p.published_at FROM posts p
WHERE p.kind = 'BLOG' AND (p.published_at < @c_at OR (p.published_at = @c_at AND p.id < @c_id))
ORDER BY p.published_at DESC, p.id DESC LIMIT 21;

-- F-011 sourceType
SELECT p.id, p.published_at FROM posts p
WHERE p.kind = 'BLOG' AND p.source_type = 'COMPANY'
  AND (p.published_at < @c_at OR (p.published_at = @c_at AND p.id < @c_id))
ORDER BY p.published_at DESC, p.id DESC LIMIT 21;

-- F-011 sourceIds: blog source ids only (server validates kind), no kind condition needed
-- F-011 sourceIds, single
SELECT p.id, p.published_at FROM posts p
WHERE p.source_id = 35
  AND (p.published_at < @c_at OR (p.published_at = @c_at AND p.id < @c_id))
ORDER BY p.published_at DESC, p.id DESC LIMIT 21;

-- F-011 sourceIds, multiple: IN (baseline)
SELECT p.id, p.published_at FROM posts p
WHERE p.source_id IN (35, 33, 14, 36, 6)
  AND (p.published_at < @c_at OR (p.published_at = @c_at AND p.id < @c_id))
ORDER BY p.published_at DESC, p.id DESC LIMIT 21;

-- F-011 sourceIds, multiple: UNION ALL per source (recommended)
SELECT u.id, u.published_at FROM (
  (SELECT id, published_at FROM posts WHERE source_id = 35 AND (published_at < @c_at OR (published_at = @c_at AND id < @c_id)) ORDER BY published_at DESC, id DESC LIMIT 21)
  UNION ALL
  (SELECT id, published_at FROM posts WHERE source_id = 33 AND (published_at < @c_at OR (published_at = @c_at AND id < @c_id)) ORDER BY published_at DESC, id DESC LIMIT 21)
  UNION ALL
  (SELECT id, published_at FROM posts WHERE source_id = 14 AND (published_at < @c_at OR (published_at = @c_at AND id < @c_id)) ORDER BY published_at DESC, id DESC LIMIT 21)
) u ORDER BY u.published_at DESC, u.id DESC LIMIT 21;

-- F-011 tagIds, single
SELECT pt.post_id, pt.published_at FROM post_tags pt
WHERE pt.tag_id = 1 AND pt.kind = 'BLOG'
  AND (pt.published_at < @c_at OR (pt.published_at = @c_at AND pt.post_id < @c_id))
ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21;

-- F-011 tagIds, multiple: IN + GROUP BY (baseline)
SELECT pt.post_id, MAX(pt.published_at) published_at FROM post_tags pt
WHERE pt.tag_id IN (1, 3, 119) AND pt.kind = 'BLOG'
  AND (pt.published_at < @c_at OR (pt.published_at = @c_at AND pt.post_id < @c_id))
GROUP BY pt.post_id
ORDER BY published_at DESC, pt.post_id DESC LIMIT 21;

-- F-011 tagIds, multiple: UNION per tag (recommended, UNION removes duplicate posts)
SELECT u.post_id, u.published_at FROM (
  (SELECT post_id, published_at FROM post_tags WHERE tag_id = 1 AND kind = 'BLOG' AND (published_at < @c_at OR (published_at = @c_at AND post_id < @c_id)) ORDER BY published_at DESC, post_id DESC LIMIT 21)
  UNION
  (SELECT post_id, published_at FROM post_tags WHERE tag_id = 3 AND kind = 'BLOG' AND (published_at < @c_at OR (published_at = @c_at AND post_id < @c_id)) ORDER BY published_at DESC, post_id DESC LIMIT 21)
  UNION
  (SELECT post_id, published_at FROM post_tags WHERE tag_id = 119 AND kind = 'BLOG' AND (published_at < @c_at OR (published_at = @c_at AND post_id < @c_id)) ORDER BY published_at DESC, post_id DESC LIMIT 21)
) u ORDER BY u.published_at DESC, u.post_id DESC LIMIT 21;

-- F-011 tagIds + sourceType (tag index drives, posts filters)
SELECT pt.post_id, pt.published_at FROM post_tags pt
JOIN posts p ON p.id = pt.post_id AND p.source_type = 'COMPANY'
WHERE pt.tag_id = 1 AND pt.kind = 'BLOG'
  AND (pt.published_at < @c_at OR (pt.published_at = @c_at AND pt.post_id < @c_id))
ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21;

-- F-013 popular, MONTH rolling window
SELECT p.id, p.view_count FROM posts p
WHERE p.kind = 'BLOG' AND p.published_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY
ORDER BY p.view_count DESC, p.id DESC LIMIT 20;

-- F-010 card hydration for page ids
SELECT pt.post_id, pt.tag_id, pt.tag_rank FROM post_tags pt WHERE pt.post_id IN (1088, 1087, 1086) ORDER BY pt.post_id, pt.tag_rank;

-- F-010 member flags
SELECT b.post_id FROM bookmarks b WHERE b.user_id = 1 AND b.post_id IN (1088, 1087, 1086);
SELECT r.post_id FROM read_histories r WHERE r.user_id = 1 AND r.post_id IN (1088, 1087, 1086);

-- F-016 field (021): server builds tag ids per field from tags.category, one subquery per tag, UNION
SELECT u.id, u.published_at FROM (
  (SELECT post_id AS id, published_at FROM post_tags WHERE tag_id = 140 AND kind = 'BLOG' AND (published_at < @c_at OR (published_at = @c_at AND post_id < @c_id)) ORDER BY published_at DESC, post_id DESC LIMIT 21)
  UNION
  (SELECT post_id AS id, published_at FROM post_tags WHERE tag_id = 141 AND kind = 'BLOG' AND (published_at < @c_at OR (published_at = @c_at AND post_id < @c_id)) ORDER BY published_at DESC, post_id DESC LIMIT 21)
) u ORDER BY u.published_at DESC, u.id DESC LIMIT 21;

-- F-016 field + sourceType: same UNION, each subquery joins posts
(SELECT pt.post_id AS id, pt.published_at FROM post_tags pt JOIN posts p ON p.id = pt.post_id
 WHERE pt.tag_id = 140 AND pt.kind = 'BLOG' AND p.source_type = 'PERSONAL'
   AND (pt.published_at < @c_at OR (pt.published_at = @c_at AND pt.post_id < @c_id))
 ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21);

-- F-016 field + tagIds / sourceIds / popular: selected filter drives, field checked by EXISTS on post_tags PK
SELECT pt.post_id, pt.published_at FROM post_tags pt
WHERE pt.tag_id = 76 AND pt.kind = 'BLOG'
  AND (pt.published_at < @c_at OR (pt.published_at = @c_at AND pt.post_id < @c_id))
  AND EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = pt.post_id AND fx.tag_id IN (140, 141))
ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21;

SELECT p.id FROM posts p
WHERE p.kind = 'BLOG' AND p.published_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY AND p.view_count > 0
  AND EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = p.id AND fx.tag_id IN (140, 141))
ORDER BY p.view_count DESC, p.published_at DESC, p.id DESC LIMIT 20;

-- F-071 security news, all
SELECT p.id, p.published_at FROM posts p
WHERE p.kind = 'SECURITY_NEWS' AND (p.published_at < @c_at OR (p.published_at = @c_at AND p.id < @c_id))
ORDER BY p.published_at DESC, p.id DESC LIMIT 21;

-- F-071 security news, region or sourceIds: region -> source ids, UNION ALL per source (same as F-011)
SELECT u.id, u.published_at FROM (
  (SELECT id, published_at FROM posts WHERE source_id = 37 AND (published_at < @c_at OR (published_at = @c_at AND id < @c_id)) ORDER BY published_at DESC, id DESC LIMIT 21)
  UNION ALL
  (SELECT id, published_at FROM posts WHERE source_id = 38 AND (published_at < @c_at OR (published_at = @c_at AND id < @c_id)) ORDER BY published_at DESC, id DESC LIMIT 21)
) u ORDER BY u.published_at DESC, u.id DESC LIMIT 21;

-- 021 kind consistency check: every row must be 0
SELECT
  (SELECT COUNT(*) FROM posts p JOIN sources s ON s.id = p.source_id WHERE p.kind <> s.kind) AS posts_kind_mismatch,
  (SELECT COUNT(*) FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.kind <> p.kind) AS post_tags_kind_mismatch,
  (SELECT COUNT(*) FROM posts p JOIN post_search ps ON ps.post_id = p.id WHERE p.kind = 'SECURITY_NEWS') AS news_in_search,
  (SELECT COUNT(*) FROM posts WHERE kind = 'SECURITY_NEWS' AND (thumbnail_url IS NOT NULL OR CHAR_LENGTH(summary) > 150)) AS news_copyright_violation;
