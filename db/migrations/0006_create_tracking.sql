-- migrate:up
CREATE TABLE post_view_guards (
  post_id     BIGINT UNSIGNED NOT NULL,
  viewer_key  BINARY(16)      NOT NULL,
  counted_at  DATETIME(3)     NOT NULL,
  PRIMARY KEY (post_id, viewer_key),
  KEY idx_post_view_guards_counted (counted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recommendation_impressions (
  id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  request_id     BINARY(16)       NOT NULL,
  user_id        BIGINT UNSIGNED  NULL,
  post_id        BIGINT UNSIGNED  NOT NULL,
  algorithm      VARCHAR(20)      CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  position       SMALLINT UNSIGNED NOT NULL,
  reason         VARCHAR(200)     NULL,
  shown_at       DATETIME(3)      NOT NULL,
  clicked_at     DATETIME(3)      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rec_impressions_request_post (request_id, post_id),
  KEY idx_rec_impressions_shown (shown_at, algorithm),
  KEY idx_rec_impressions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS recommendation_impressions;
DROP TABLE IF EXISTS post_view_guards;
