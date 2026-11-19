SET NAMES utf8mb4;
SET foreign_key_checks = 0;

INSERT INTO users (id, email, password_hash, nickname, onboarding_completed_at, created_at)
SELECT seq, CONCAT('perf', seq, '@example.test'),
       '$2b$10$perfseedperfseedperfseOb6m6Z3c3Zq0yJ6Y0dQh1n7l9h8vYlK',
       CONCAT('perf', seq),
       UTC_TIMESTAMP(3) - INTERVAL (seq % 700) DAY,
       UTC_TIMESTAMP(3) - INTERVAL (seq % 700) DAY
FROM seq_1_to_10000;

CREATE TEMPORARY TABLE tag_pick (rn INT PRIMARY KEY, id BIGINT UNSIGNED)
SELECT ROW_NUMBER() OVER (ORDER BY id) AS rn, id FROM tags;
SET @tag_n = (SELECT COUNT(*) FROM tag_pick);
SET @post_n = (SELECT MAX(id) FROM posts);

INSERT IGNORE INTO user_interest_tags (user_id, tag_id)
SELECT u.seq, tp.id
FROM seq_1_to_10000 u
JOIN seq_1_to_10 n ON n.seq <= 3 + (u.seq % 8)
JOIN tag_pick tp ON tp.rn = 1 + FLOOR(POW(RAND(u.seq * 100 + n.seq), 2) * @tag_n);

INSERT IGNORE INTO bookmarks (user_id, post_id, created_at)
SELECT u.seq,
       @post_n - FLOOR(POW(RAND(u.seq * 1000 + n.seq), 2) * @post_n),
       UTC_TIMESTAMP(3) - INTERVAL FLOOR(RAND(u.seq * 7 + n.seq) * 365 * 86400) SECOND
FROM seq_1_to_10000 u
JOIN seq_1_to_100 n ON n.seq <= (u.seq * 37) % 101;

INSERT IGNORE INTO read_histories (user_id, post_id, first_read_at, last_read_at)
SELECT u.seq,
       @post_n - FLOOR(POW(RAND(u.seq * 10000 + n.seq), 3) * @post_n),
       UTC_TIMESTAMP(3) - INTERVAL FLOOR(POW(RAND(u.seq * 13 + n.seq), 2) * 365 * 86400) SECOND,
       UTC_TIMESTAMP(3) - INTERVAL FLOOR(POW(RAND(u.seq * 13 + n.seq), 2) * 365 * 86400) SECOND
FROM seq_1_to_10000 u
JOIN seq_1_to_400 n ON n.seq <= (u.seq * 53) % 401;

SET foreign_key_checks = 1;
