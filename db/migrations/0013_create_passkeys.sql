-- migrate:up
ALTER TABLE users
  ADD COLUMN webauthn_handle BINARY(32) NULL AFTER nickname,
  ALGORITHM=INSTANT;

ALTER TABLE users
  ADD UNIQUE KEY uk_users_webauthn_handle (webauthn_handle),
  ALGORITHM=INPLACE, LOCK=NONE;

CREATE TABLE user_passkeys (
  id               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED   NOT NULL,
  credential_id    VARBINARY(1023)   NOT NULL,
  public_key       VARBINARY(2048)   NOT NULL,
  sign_count       INT UNSIGNED      NOT NULL DEFAULT 0,
  transports       VARCHAR(255)      NULL,
  aaguid           BINARY(16)        NULL,
  backup_eligible  BOOLEAN           NOT NULL DEFAULT FALSE,
  backup_state     BOOLEAN           NOT NULL DEFAULT FALSE,
  name             VARCHAR(40)       NOT NULL,
  created_at       DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at     DATETIME(3)       NULL,
  updated_at       DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_passkeys_credential (credential_id),
  KEY idx_user_passkeys_user_created (user_id, created_at),
  CONSTRAINT fk_user_passkeys_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_user_passkeys_name CHECK (CHAR_LENGTH(TRIM(name)) >= 1),
  CONSTRAINT ck_user_passkeys_credential CHECK (LENGTH(credential_id) >= 16)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webauthn_challenges (
  challenge_hash  BINARY(32)       NOT NULL,
  purpose         ENUM('REGISTER','LOGIN') NOT NULL,
  user_id         BIGINT UNSIGNED  NULL,
  expires_at      DATETIME(3)      NOT NULL,
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (challenge_hash),
  KEY idx_webauthn_challenges_expires (expires_at),
  KEY idx_webauthn_challenges_user (user_id),
  CONSTRAINT fk_webauthn_challenges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_webauthn_challenges_purpose CHECK ((purpose = 'REGISTER') = (user_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS webauthn_challenges;
DROP TABLE IF EXISTS user_passkeys;
ALTER TABLE users
  DROP INDEX uk_users_webauthn_handle,
  ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE users
  DROP COLUMN webauthn_handle,
  ALGORITHM=INSTANT;
