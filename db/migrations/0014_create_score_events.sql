-- migrate:up
ALTER TABLE users
  ADD COLUMN score INT UNSIGNED NOT NULL DEFAULT 0 AFTER webauthn_handle,
  ALGORITHM=INSTANT;

CREATE TABLE score_events (
  user_id     BIGINT UNSIGNED   NOT NULL,
  kind        ENUM('READ','LIKE','COMMENT','ARCHIVE') NOT NULL,
  ref_id      BIGINT UNSIGNED   NOT NULL,
  points      INT UNSIGNED      NOT NULL,
  created_at  DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at  DATETIME(3)       NULL,
  PRIMARY KEY (user_id, kind, ref_id),
  KEY idx_score_events_user_kind_created (user_id, kind, created_at),
  CONSTRAINT fk_score_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_score_events_revoked CHECK (revoked_at IS NULL OR kind = 'COMMENT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS score_events;
ALTER TABLE users
  DROP COLUMN score,
  ALGORITHM=INSTANT;
