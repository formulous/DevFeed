-- migrate:up
ALTER TABLE posts
  ADD COLUMN like_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER view_count,
  ADD COLUMN comment_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER like_count,
  ALGORITHM=INSTANT;

CREATE TABLE post_likes (
  user_id     BIGINT UNSIGNED NOT NULL,
  post_id     BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, post_id),
  KEY idx_post_likes_post (post_id),
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id     BIGINT UNSIGNED NOT NULL,
  parent_id   BIGINT UNSIGNED NULL,
  user_id     BIGINT UNSIGNED NULL,
  body        VARCHAR(1000)   NULL,
  status      ENUM('VISIBLE','HIDDEN','DELETED') NOT NULL DEFAULT 'VISIBLE',
  reply_count INT UNSIGNED    NOT NULL DEFAULT 0,
  edited_at   DATETIME(3)     NULL,
  hidden_at   DATETIME(3)     NULL,
  hidden_by   BIGINT UNSIGNED NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_comments_post_parent (post_id, parent_id, id),
  KEY idx_comments_parent (parent_id, id),
  KEY idx_comments_user_created (user_id, created_at),
  KEY idx_comments_hidden_by (hidden_by),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_comments_hidden_by FOREIGN KEY (hidden_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT ck_comments_status_body CHECK (
    (status = 'DELETED' AND body IS NULL AND user_id IS NULL)
    OR (status <> 'DELETED' AND body IS NOT NULL AND CHAR_LENGTH(body) >= 1 AND user_id IS NOT NULL)
  ),
  CONSTRAINT ck_comments_hidden CHECK ((status = 'HIDDEN') = (hidden_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS post_likes;
ALTER TABLE posts
  DROP COLUMN comment_count,
  DROP COLUMN like_count,
  ALGORITHM=INSTANT;
