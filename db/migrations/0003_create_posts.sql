-- migrate:up
CREATE TABLE posts (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_id              BIGINT UNSIGNED NOT NULL,
  source_type            ENUM('COMPANY','PERSONAL') NOT NULL,
  guid                   VARCHAR(1024)   NULL,
  guid_hash              BINARY(32)      AS (UNHEX(SHA2(guid, 256))) STORED,
  url                    VARCHAR(2048)   NOT NULL,
  url_hash               BINARY(32)      AS (UNHEX(SHA2(url, 256))) STORED,
  title                  VARCHAR(500)    NOT NULL,
  summary                VARCHAR(300)    NULL,
  thumbnail_url          VARCHAR(2048)   NULL,
  published_at           DATETIME(3)     NOT NULL,
  original_published_at  DATETIME(3)     NULL,
  view_count             INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at             DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_posts_url_hash (url_hash),
  UNIQUE KEY uk_posts_source_guid_hash (source_id, guid_hash),
  KEY idx_posts_published (published_at, id),
  KEY idx_posts_source_published (source_id, published_at, id),
  KEY idx_posts_type_published (source_type, published_at, id),
  CONSTRAINT fk_posts_source FOREIGN KEY (source_id) REFERENCES sources (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_tags (
  post_id       BIGINT UNSIGNED  NOT NULL,
  tag_id        BIGINT UNSIGNED  NOT NULL,
  tag_rank      TINYINT UNSIGNED NOT NULL,
  published_at  DATETIME(3)      NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  KEY idx_post_tags_tag_published (tag_id, published_at, post_id),
  CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
  CONSTRAINT ck_post_tags_rank CHECK (tag_rank BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_search (
  post_id       BIGINT UNSIGNED NOT NULL,
  title_tokens  TEXT            NOT NULL,
  body_tokens   TEXT            NOT NULL,
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (post_id),
  FULLTEXT KEY ft_post_search_title (title_tokens),
  FULLTEXT KEY ft_post_search_all (title_tokens, body_tokens),
  CONSTRAINT fk_post_search_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS post_search;
DROP TABLE IF EXISTS post_tags;
DROP TABLE IF EXISTS posts;
