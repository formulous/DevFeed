-- migrate:up
ALTER TABLE posts
  ADD INDEX idx_posts_search_filter (id, published_at, source_id, source_type),
  ALGORITHM=INPLACE, LOCK=NONE;

-- migrate:down
ALTER TABLE posts
  DROP INDEX idx_posts_search_filter,
  ALGORITHM=INPLACE, LOCK=NONE;
