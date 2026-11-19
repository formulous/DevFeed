-- migrate:up
CREATE TABLE bookmarks (
  user_id     BIGINT UNSIGNED NOT NULL,
  post_id     BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, post_id),
  KEY idx_bookmarks_user_created (user_id, created_at, post_id),
  KEY idx_bookmarks_post (post_id),
  CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bookmarks_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE read_histories (
  user_id        BIGINT UNSIGNED NOT NULL,
  post_id        BIGINT UNSIGNED NOT NULL,
  first_read_at  DATETIME(3)     NOT NULL,
  last_read_at   DATETIME(3)     NOT NULL,
  PRIMARY KEY (user_id, post_id),
  KEY idx_read_histories_user_last_read (user_id, last_read_at, post_id),
  KEY idx_read_histories_last_read (last_read_at),
  KEY idx_read_histories_post (post_id),
  CONSTRAINT fk_read_histories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_read_histories_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS read_histories;
DROP TABLE IF EXISTS bookmarks;
