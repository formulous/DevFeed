-- migrate:up
ALTER TABLE sources
  ADD COLUMN kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG' AFTER source_type,
  ADD COLUMN region ENUM('DOMESTIC','OVERSEAS') NULL AFTER kind,
  ADD CONSTRAINT ck_sources_kind_region CHECK ((kind = 'BLOG' AND region IS NULL) OR (kind = 'SECURITY_NEWS' AND region IS NOT NULL));

ALTER TABLE posts
  ADD COLUMN kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG' AFTER source_type,
  ALGORITHM=INSTANT;

ALTER TABLE posts
  ADD INDEX idx_posts_kind_published (kind, published_at, id),
  ADD INDEX idx_posts_kind_type_published (kind, source_type, published_at, id),
  DROP INDEX idx_posts_published,
  DROP INDEX idx_posts_type_published,
  ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE post_tags
  ADD COLUMN kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG' AFTER published_at,
  ALGORITHM=INSTANT;

ALTER TABLE post_tags
  ADD INDEX idx_post_tags_tag_kind_published (tag_id, kind, published_at, post_id),
  DROP INDEX idx_post_tags_tag_published,
  ALGORITHM=INPLACE, LOCK=NONE;

-- migrate:down
ALTER TABLE post_tags
  ADD INDEX idx_post_tags_tag_published (tag_id, published_at, post_id),
  DROP INDEX idx_post_tags_tag_kind_published,
  ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE post_tags DROP COLUMN kind;

ALTER TABLE posts
  ADD INDEX idx_posts_published (published_at, id),
  ADD INDEX idx_posts_type_published (source_type, published_at, id),
  DROP INDEX idx_posts_kind_published,
  DROP INDEX idx_posts_kind_type_published,
  ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE posts DROP COLUMN kind;

ALTER TABLE sources
  DROP CONSTRAINT ck_sources_kind_region,
  DROP COLUMN region,
  DROP COLUMN kind;
