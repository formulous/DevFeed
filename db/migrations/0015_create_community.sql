-- migrate:up
ALTER TABLE sources
  MODIFY COLUMN kind ENUM('BLOG','SECURITY_NEWS','COMMUNITY') NOT NULL DEFAULT 'BLOG',
  DROP CONSTRAINT ck_sources_kind_region,
  ADD CONSTRAINT ck_sources_kind_region CHECK ((kind IN ('BLOG','COMMUNITY') AND region IS NULL) OR (kind = 'SECURITY_NEWS' AND region IS NOT NULL));

INSERT INTO sources (name, site_url, feed_url, source_type, kind, status, crawl_interval_min)
VALUES ('DevFeed 커뮤니티', 'https://formulous.org/dev-feed/community', 'internal:community', 'PERSONAL', 'COMMUNITY', 'INACTIVE', 1440)
ON DUPLICATE KEY UPDATE kind = VALUES(kind), status = VALUES(status);

ALTER TABLE posts
  MODIFY COLUMN kind ENUM('BLOG','SECURITY_NEWS','COMMUNITY') NOT NULL DEFAULT 'BLOG',
  ALGORITHM=INSTANT;

ALTER TABLE post_tags
  MODIFY COLUMN kind ENUM('BLOG','SECURITY_NEWS','COMMUNITY') NOT NULL DEFAULT 'BLOG',
  ALGORITHM=INSTANT;

CREATE TABLE community_posts (
  post_id              BIGINT UNSIGNED NOT NULL,
  user_id              BIGINT UNSIGNED NULL,
  category             ENUM('QUESTION','DISCUSSION','SHARE') NOT NULL,
  body                 MEDIUMTEXT      NULL,
  status               ENUM('VISIBLE','HIDDEN','DELETED') NOT NULL DEFAULT 'VISIBLE',
  accepted_comment_id  BIGINT UNSIGNED NULL,
  published_at         DATETIME(3)     NOT NULL,
  edited_at            DATETIME(3)     NULL,
  hidden_at            DATETIME(3)     NULL,
  hidden_by            BIGINT UNSIGNED NULL,
  hidden_reason        ENUM('ADMIN','REPORTS') NULL,
  created_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (post_id),
  KEY idx_community_posts_status_published (status, published_at, post_id),
  KEY idx_community_posts_status_category_published (status, category, published_at, post_id),
  KEY idx_community_posts_user_created (user_id, created_at),
  KEY idx_community_posts_accepted (accepted_comment_id),
  KEY idx_community_posts_hidden_by (hidden_by),
  CONSTRAINT fk_community_posts_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_community_posts_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_community_posts_accepted FOREIGN KEY (accepted_comment_id) REFERENCES comments (id) ON DELETE SET NULL,
  CONSTRAINT fk_community_posts_hidden_by FOREIGN KEY (hidden_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT ck_community_posts_status_body CHECK (
    (status = 'DELETED' AND body IS NULL AND user_id IS NULL)
    OR (status <> 'DELETED' AND body IS NOT NULL AND CHAR_LENGTH(body) BETWEEN 10 AND 20000 AND user_id IS NOT NULL)
  ),
  CONSTRAINT ck_community_posts_hidden CHECK ((status = 'HIDDEN') = (hidden_at IS NOT NULL AND hidden_reason IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE comments
  ADD COLUMN hidden_reason ENUM('ADMIN','REPORTS') NULL AFTER hidden_by,
  ALGORITHM=INSTANT;

UPDATE comments SET hidden_reason = 'ADMIN' WHERE status = 'HIDDEN';

ALTER TABLE comments
  DROP CONSTRAINT ck_comments_hidden,
  ADD CONSTRAINT ck_comments_hidden CHECK ((status = 'HIDDEN') = (hidden_at IS NOT NULL AND hidden_reason IS NOT NULL));

CREATE TABLE report_targets (
  target_type    ENUM('POST','COMMENT') NOT NULL,
  target_id      BIGINT UNSIGNED  NOT NULL,
  report_count   INT UNSIGNED     NOT NULL DEFAULT 0,
  state          ENUM('PENDING','HIDDEN','CLEARED') NOT NULL DEFAULT 'PENDING',
  first_reported_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_reported_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at    DATETIME(3)      NULL,
  resolved_by    BIGINT UNSIGNED  NULL,
  PRIMARY KEY (target_type, target_id),
  KEY idx_report_targets_state_last (state, last_reported_at),
  KEY idx_report_targets_resolved_by (resolved_by),
  CONSTRAINT fk_report_targets_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  target_type   ENUM('POST','COMMENT') NOT NULL,
  target_id     BIGINT UNSIGNED  NOT NULL,
  reporter_id   BIGINT UNSIGNED  NULL,
  reason        ENUM('SPAM','ABUSE','PRIVACY','OTHER') NOT NULL,
  detail        VARCHAR(200)     NULL,
  created_at    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_reports_target_reporter (target_type, target_id, reporter_id),
  KEY idx_reports_reporter (reporter_id),
  CONSTRAINT fk_reports_target FOREIGN KEY (target_type, target_id) REFERENCES report_targets (target_type, target_id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT ck_reports_detail CHECK (detail IS NULL OR reason = 'OTHER')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE score_events
  MODIFY COLUMN kind ENUM('READ','LIKE','COMMENT','ARCHIVE','POST_WRITE','LIKE_RECEIVED') NOT NULL,
  ADD COLUMN actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER ref_id,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (user_id, kind, ref_id, actor_id),
  DROP CONSTRAINT ck_score_events_revoked,
  ADD CONSTRAINT ck_score_events_revoked CHECK (revoked_at IS NULL OR kind IN ('COMMENT','POST_WRITE')),
  ADD CONSTRAINT ck_score_events_actor CHECK ((kind = 'LIKE_RECEIVED') = (actor_id <> 0));

-- migrate:down
ALTER TABLE score_events
  DROP CONSTRAINT ck_score_events_actor,
  DROP CONSTRAINT ck_score_events_revoked,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (user_id, kind, ref_id),
  DROP COLUMN actor_id,
  MODIFY COLUMN kind ENUM('READ','LIKE','COMMENT','ARCHIVE') NOT NULL,
  ADD CONSTRAINT ck_score_events_revoked CHECK (revoked_at IS NULL OR kind = 'COMMENT');

DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS report_targets;

ALTER TABLE comments
  DROP CONSTRAINT ck_comments_hidden,
  ADD CONSTRAINT ck_comments_hidden CHECK ((status = 'HIDDEN') = (hidden_at IS NOT NULL)),
  DROP COLUMN hidden_reason;

DROP TABLE IF EXISTS community_posts;

ALTER TABLE post_tags
  MODIFY COLUMN kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG';

ALTER TABLE posts
  MODIFY COLUMN kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG';

DELETE FROM sources WHERE feed_url = 'internal:community' AND kind = 'COMMUNITY';

ALTER TABLE sources
  DROP CONSTRAINT ck_sources_kind_region,
  MODIFY COLUMN kind ENUM('BLOG','SECURITY_NEWS') NOT NULL DEFAULT 'BLOG',
  ADD CONSTRAINT ck_sources_kind_region CHECK ((kind = 'BLOG' AND region IS NULL) OR (kind = 'SECURITY_NEWS' AND region IS NOT NULL));
