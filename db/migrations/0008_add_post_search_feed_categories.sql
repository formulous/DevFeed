-- migrate:up
ALTER TABLE post_search
  ADD COLUMN feed_categories VARCHAR(500) NULL AFTER body_tokens,
  ALGORITHM=COPY;

-- migrate:down
ALTER TABLE post_search
  DROP COLUMN feed_categories,
  ALGORITHM=COPY;
