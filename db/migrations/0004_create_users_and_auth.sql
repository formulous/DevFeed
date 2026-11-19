-- migrate:up
CREATE TABLE users (
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email                    VARCHAR(255)    NOT NULL,
  password_hash            VARCHAR(255)    NOT NULL,
  nickname                 VARCHAR(30)     NOT NULL,
  role                     ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  failed_login_count       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until             DATETIME(3)     NULL,
  onboarding_completed_at  DATETIME(3)     NULL,
  last_login_at            DATETIME(3)     NULL,
  created_at               DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  BINARY(32)      NOT NULL,
  family_id   BINARY(16)      NOT NULL,
  expires_at  DATETIME(3)     NOT NULL,
  revoked_at  DATETIME(3)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_refresh_tokens_token_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  KEY idx_refresh_tokens_family (family_id),
  KEY idx_refresh_tokens_expires (expires_at),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_interest_tags (
  user_id     BIGINT UNSIGNED NOT NULL,
  tag_id      BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, tag_id),
  KEY idx_user_interest_tags_tag (tag_id),
  CONSTRAINT fk_user_interest_tags_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_interest_tags_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS user_interest_tags;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
