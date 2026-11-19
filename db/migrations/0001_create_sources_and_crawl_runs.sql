-- migrate:up
CREATE TABLE sources (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                  VARCHAR(100)    NOT NULL,
  site_url              VARCHAR(2048)   NOT NULL,
  feed_url              VARCHAR(2048)   NOT NULL,
  feed_url_hash         BINARY(32)      AS (UNHEX(SHA2(feed_url, 256))) STORED,
  source_type           ENUM('COMPANY','PERSONAL') NOT NULL,
  logo_url              VARCHAR(2048)   NULL,
  crawl_interval_min    SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  status                ENUM('ACTIVE','ERROR','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  consecutive_failures  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  next_crawl_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  crawl_locked_until    DATETIME(3)     NULL,
  last_crawled_at       DATETIME(3)     NULL,
  last_success_at       DATETIME(3)     NULL,
  etag                  VARCHAR(255)    NULL,
  last_modified         VARCHAR(64)     NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_sources_feed_url_hash (feed_url_hash),
  KEY idx_sources_status_next_crawl (status, next_crawl_at),
  CONSTRAINT ck_sources_crawl_interval CHECK (crawl_interval_min >= 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crawl_runs (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_id           BIGINT UNSIGNED NOT NULL,
  trigger_type        ENUM('SCHEDULED','MANUAL') NOT NULL,
  result              ENUM('RUNNING','SUCCESS','NOT_MODIFIED','FAILURE') NOT NULL DEFAULT 'RUNNING',
  started_at          DATETIME(3)     NOT NULL,
  finished_at         DATETIME(3)     NULL,
  attempt_count       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  http_status         SMALLINT UNSIGNED NULL,
  fetched_count       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  new_post_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_post_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  error_message       VARCHAR(1000)   NULL,
  PRIMARY KEY (id),
  KEY idx_crawl_runs_source_started (source_id, started_at),
  KEY idx_crawl_runs_started (started_at),
  CONSTRAINT fk_crawl_runs_source FOREIGN KEY (source_id) REFERENCES sources (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS crawl_runs;
DROP TABLE IF EXISTS sources;
