-- migrate:up
UPDATE sources SET name = 'formulous 커뮤니티', site_url = 'https://formulous.org/community'
WHERE feed_url = 'internal:community' AND kind = 'COMMUNITY';

UPDATE posts SET url = CONCAT('https://formulous.org/community/posts/', id)
WHERE kind = 'COMMUNITY' AND url = CONCAT('https://formulous.org/dev-feed/community/posts/', id);

-- migrate:down
UPDATE posts SET url = CONCAT('https://formulous.org/dev-feed/community/posts/', id)
WHERE kind = 'COMMUNITY' AND url = CONCAT('https://formulous.org/community/posts/', id);

UPDATE sources SET name = 'DevFeed 커뮤니티', site_url = 'https://formulous.org/dev-feed/community'
WHERE feed_url = 'internal:community' AND kind = 'COMMUNITY';
