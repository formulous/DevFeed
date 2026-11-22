-- migrate:up
CREATE TABLE security_news_search (
  post_id       BIGINT UNSIGNED NOT NULL,
  title_tokens  TEXT            NOT NULL,
  body_tokens   TEXT            NOT NULL,
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (post_id),
  FULLTEXT KEY ft_security_news_search_title (title_tokens),
  FULLTEXT KEY ft_security_news_search_all (title_tokens, body_tokens),
  CONSTRAINT fk_security_news_search_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE community_search (
  post_id       BIGINT UNSIGNED NOT NULL,
  title_tokens  TEXT            NOT NULL,
  body_tokens   TEXT            NOT NULL,
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (post_id),
  FULLTEXT KEY ft_community_search_title (title_tokens),
  FULLTEXT KEY ft_community_search_all (title_tokens, body_tokens),
  CONSTRAINT fk_community_search_post FOREIGN KEY (post_id) REFERENCES community_posts (post_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE IF EXISTS community_search;
DROP TABLE IF EXISTS security_news_search;
