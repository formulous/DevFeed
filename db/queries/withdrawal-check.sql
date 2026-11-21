-- F-032 residual personal data check for a withdrawn user
-- @uid  : withdrawn users.id
-- @vkey : UNHEX(LEFT(SHA2(CONCAT('u:', @uid), 256), 32))
SELECT 'users' AS tbl, COUNT(*) AS remaining FROM users WHERE id = @uid
UNION ALL SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens WHERE user_id = @uid
UNION ALL SELECT 'user_interest_tags', COUNT(*) FROM user_interest_tags WHERE user_id = @uid
UNION ALL SELECT 'bookmarks', COUNT(*) FROM bookmarks WHERE user_id = @uid
UNION ALL SELECT 'read_histories', COUNT(*) FROM read_histories WHERE user_id = @uid
UNION ALL SELECT 'recommendation_impressions', COUNT(*) FROM recommendation_impressions WHERE user_id = @uid
UNION ALL SELECT 'post_view_guards', COUNT(*) FROM post_view_guards WHERE viewer_key = @vkey
UNION ALL SELECT 'post_likes', COUNT(*) FROM post_likes WHERE user_id = @uid
UNION ALL SELECT 'comments', COUNT(*) FROM comments WHERE user_id = @uid;
