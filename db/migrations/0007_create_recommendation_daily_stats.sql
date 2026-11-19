-- migrate:up
CREATE TABLE recommendation_daily_stats (
  stat_date         DATE         NOT NULL,
  algorithm         VARCHAR(20)  CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  impression_count  INT UNSIGNED NOT NULL DEFAULT 0,
  click_count       INT UNSIGNED NOT NULL DEFAULT 0,
  request_count     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (stat_date, algorithm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS recommendation_daily_stats;
