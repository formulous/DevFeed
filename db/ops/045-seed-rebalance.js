const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const { markdownExcerpt } = require(path.join(root, 'server/dist/community/markdown-excerpt'));
const { toTokenString } = require(path.join(root, 'server/dist/ingest/tokenizer'));
const { SEARCH_BODY_MAX } = require(path.join(root, 'server/dist/community/community-store'));

const [trimFile, newFile, metaFile] = process.argv.slice(2);
const trim = JSON.parse(fs.readFileSync(trimFile, 'utf8'));
const posts = JSON.parse(fs.readFileSync(newFile, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));

const SEED_MIN = 22;
const SEED_MAX = 41;
const COMMUNITY_SOURCE = meta.communitySourceId;
const BASE_URL = 'https://formulous.org/community/posts/';
const expected = meta.expected;

const hex = (s) => `CONVERT(X'${Buffer.from(String(s), 'utf8').toString('hex')}' USING utf8mb4)`;
const str = (s) => (s === null || s === undefined ? 'NULL' : hex(s));
const ts = (iso) => `'${iso.replace('T', ' ').replace('Z', '')}'`;
const int = (n) => String(Number.parseInt(n, 10));
const uid = (nick) => {
  const id = meta.users[nick];
  if (!id) throw new Error(`unknown nickname ${nick}`);
  return id;
};
const addMinutes = (iso, m) => new Date(Date.parse(iso) + m * 60000).toISOString();

const tagText = (names) =>
  [...new Set(names.flatMap((n) => [n, ...(meta.synonyms[n] ?? [])]))].join(' ');

const out = [];
const push = (s) => out.push(s);

push(`SET @dry = ${process.env.APPLY === '1' ? 'FALSE' : 'TRUE'};`);
push(`CREATE TEMPORARY TABLE trim_del (id BIGINT UNSIGNED PRIMARY KEY);`);
push(`INSERT INTO trim_del VALUES ${trim.deleteCommentIds.map((i) => `(${int(i)})`).join(',')};`);
push(`CREATE TEMPORARY TABLE trim_post (post_id BIGINT UNSIGNED PRIMARY KEY, likes_after INT NOT NULL, keep_seed INT NULL);`);
push(`INSERT INTO trim_post (post_id, likes_after) VALUES ${trim.posts.map((p) => `(${int(p.postId)},${int(p.likesAfter)})`).join(',')};`);

push(`CREATE TEMPORARY TABLE np (k VARCHAR(32) PRIMARY KEY, seq INT NOT NULL, user_id BIGINT UNSIGNED NOT NULL, category VARCHAR(16) NOT NULL,
  title VARCHAR(500) NOT NULL, body MEDIUMTEXT NOT NULL, summary VARCHAR(300) NULL, published_at DATETIME(3) NOT NULL, view_count INT NOT NULL,
  title_tokens TEXT NOT NULL, body_tokens TEXT NOT NULL, accept_key VARCHAR(32) NULL, post_id BIGINT UNSIGNED NULL) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
push(`CREATE TEMPORARY TABLE np_tag (k VARCHAR(32) NOT NULL, tag_name VARCHAR(100) NOT NULL, tag_rank TINYINT NOT NULL) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
push(`CREATE TEMPORARY TABLE nc (k VARCHAR(32) NOT NULL, ckey VARCHAR(32) NOT NULL, seq INT NOT NULL, user_id BIGINT UNSIGNED NOT NULL, body VARCHAR(1000) NOT NULL,
  created_at DATETIME(3) NOT NULL, reply_key VARCHAR(32) NULL, PRIMARY KEY (k, ckey)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
push(`CREATE TEMPORARY TABLE nc_parent (k VARCHAR(32) NOT NULL, ckey VARCHAR(32) NOT NULL, id BIGINT UNSIGNED NULL, PRIMARY KEY (k, ckey)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
push(`CREATE TEMPORARY TABLE nl (k VARCHAR(32) NOT NULL, user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

posts.forEach((p, i) => {
  const likers = p.likers ?? [];
  const views = likers.length + p.comments.length + 8 + ((i * 37) % 53);
  const title = toTokenString(p.title);
  const body = toTokenString(markdownExcerpt(p.body, SEARCH_BODY_MAX), tagText(p.tags));
  push(`INSERT INTO np VALUES (${str(p.key)},${i + 1},${uid(p.author)},${str(p.category)},${str(p.title)},${str(p.body)},${str(markdownExcerpt(p.body))},${ts(p.publishedAt)},${views},${str(title)},${str(body)},${str(p.accept ?? null)},NULL);`);
  p.tags.forEach((t, r) => push(`INSERT INTO np_tag VALUES (${str(p.key)},${str(t)},${r + 1});`));
  p.comments.forEach((c, j) =>
    push(`INSERT INTO nc VALUES (${str(p.key)},${str(c.key)},${j + 1},${uid(c.author)},${str(c.content)},${ts(c.createdAt)},${str(c.replyTo ?? null)});`),
  );
  likers.forEach((l, j) => push(`INSERT INTO nl VALUES (${str(p.key)},${uid(l)},${ts(addMinutes(p.publishedAt, 41 + j * 53))});`));
});

const seed = `BETWEEN ${SEED_MIN} AND ${SEED_MAX}`;
const fail = (cond, msg) => `IF ${cond} THEN SET @fail = ${hex(msg)}; LEAVE main; END IF;`;

push(`DELIMITER //`);
push(`BEGIN NOT ATOMIC
main: BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET @fail = 'SQL error'; RESIGNAL; END;
  SET @fail = NULL;
  START TRANSACTION;

  DELETE rt FROM report_targets rt JOIN trim_del d ON rt.target_type = 'COMMENT' AND rt.target_id = d.id JOIN comments c ON c.id = d.id WHERE c.user_id ${seed};
  DELETE c FROM comments c JOIN trim_del d ON d.id = c.id WHERE c.user_id ${seed} AND c.parent_id IS NOT NULL;
  DELETE c FROM comments c JOIN trim_del d ON d.id = c.id WHERE c.user_id ${seed};
  SET @skipped_comments = (SELECT COUNT(*) FROM trim_del d JOIN comments c ON c.id = d.id);

  UPDATE trim_post t SET keep_seed = GREATEST(t.likes_after - (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = t.post_id AND l.user_id NOT ${seed}), 0);
  CREATE TEMPORARY TABLE like_del AS
    SELECT x.user_id, x.post_id FROM (
      SELECT l.user_id, l.post_id, ROW_NUMBER() OVER (PARTITION BY l.post_id ORDER BY RAND(l.user_id * 100003 + l.post_id)) AS rn
      FROM post_likes l WHERE l.user_id ${seed} AND l.post_id IN (SELECT post_id FROM trim_post)
    ) x JOIN trim_post t ON t.post_id = x.post_id WHERE x.rn > t.keep_seed;
  DELETE l FROM post_likes l JOIN like_del d ON d.user_id = l.user_id AND d.post_id = l.post_id;
  SET @kept_real_likes = (SELECT COUNT(*) FROM trim_post t WHERE t.likes_after < (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = t.post_id));

  UPDATE users SET created_at = '2026-10-19 09:00:00.000' + INTERVAL (id - ${SEED_MIN}) * 137 MINUTE, updated_at = updated_at WHERE id ${seed};

  INSERT INTO posts (source_id, source_type, kind, url, title, summary, published_at, view_count, created_at, updated_at)
    SELECT ${COMMUNITY_SOURCE}, 'PERSONAL', 'COMMUNITY', CONCAT('internal:community:045:', k), title, summary, published_at, view_count, published_at, published_at FROM np ORDER BY seq;
  UPDATE np JOIN posts p ON p.url = CONCAT('internal:community:045:', np.k) SET np.post_id = p.id;
  ${fail(`(SELECT COUNT(*) FROM np WHERE post_id IS NULL) > 0`, 'post id mapping failed')}
  UPDATE posts p JOIN np ON np.post_id = p.id SET p.url = CONCAT('${BASE_URL}', p.id), p.updated_at = np.published_at;
  INSERT INTO community_posts (post_id, user_id, category, body, published_at, created_at, updated_at)
    SELECT post_id, user_id, category, body, published_at, published_at, published_at FROM np;
  INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at, kind)
    SELECT np.post_id, t.id, nt.tag_rank, np.published_at, 'COMMUNITY' FROM np_tag nt JOIN np ON np.k = nt.k JOIN tags t ON t.name = nt.tag_name;
  ${fail(`(SELECT COUNT(*) FROM post_tags pt JOIN np ON np.post_id = pt.post_id) <> (SELECT COUNT(*) FROM np_tag)`, 'tag mapping failed')}
  INSERT INTO community_search (post_id, title_tokens, body_tokens) SELECT post_id, title_tokens, body_tokens FROM np;

  INSERT INTO comments (post_id, parent_id, user_id, body, created_at, updated_at)
    SELECT np.post_id, NULL, nc.user_id, nc.body, nc.created_at, nc.created_at FROM nc JOIN np ON np.k = nc.k WHERE nc.reply_key IS NULL ORDER BY nc.created_at, np.seq, nc.seq;
  INSERT INTO nc_parent (k, ckey) SELECT k, ckey FROM nc WHERE reply_key IS NULL;
  UPDATE nc_parent a JOIN nc ON nc.k = a.k AND nc.ckey = a.ckey JOIN np ON np.k = a.k
    JOIN comments c ON c.post_id = np.post_id AND c.user_id = nc.user_id AND c.created_at = nc.created_at AND c.parent_id IS NULL
    SET a.id = c.id;
  ${fail(`(SELECT COUNT(*) FROM nc_parent WHERE id IS NULL) > 0`, 'comment id mapping failed')}
  INSERT INTO comments (post_id, parent_id, user_id, body, created_at, updated_at)
    SELECT np.post_id, a.id, nc.user_id, nc.body, nc.created_at, nc.created_at
    FROM nc JOIN np ON np.k = nc.k JOIN nc_parent a ON a.k = nc.k AND a.ckey = nc.reply_key WHERE nc.reply_key IS NOT NULL ORDER BY nc.created_at;
  UPDATE community_posts cp JOIN np ON np.post_id = cp.post_id JOIN nc_parent a ON a.k = np.k AND a.ckey = np.accept_key
    SET cp.accepted_comment_id = a.id, cp.updated_at = cp.updated_at;
  INSERT INTO post_likes (user_id, post_id, created_at) SELECT nl.user_id, np.post_id, nl.created_at FROM nl JOIN np ON np.k = nl.k;

  UPDATE comments par LEFT JOIN (SELECT parent_id, COUNT(*) n FROM comments WHERE parent_id IS NOT NULL GROUP BY parent_id) r ON r.parent_id = par.id
    JOIN posts p ON p.id = par.post_id AND p.kind = 'COMMUNITY'
    SET par.reply_count = IFNULL(r.n, 0), par.updated_at = par.updated_at WHERE par.parent_id IS NULL AND par.reply_count <> IFNULL(r.n, 0);
  UPDATE posts p LEFT JOIN (SELECT post_id, COUNT(*) n FROM post_likes GROUP BY post_id) l ON l.post_id = p.id
    SET p.like_count = IFNULL(l.n, 0), p.updated_at = p.updated_at WHERE p.kind = 'COMMUNITY' AND p.like_count <> IFNULL(l.n, 0);
  UPDATE posts p LEFT JOIN (SELECT post_id, COUNT(*) n FROM comments WHERE status = 'VISIBLE' GROUP BY post_id) c ON c.post_id = p.id
    SET p.comment_count = IFNULL(c.n, 0), p.updated_at = p.updated_at WHERE p.kind = 'COMMUNITY' AND p.comment_count <> IFNULL(c.n, 0);

  DELETE FROM score_events WHERE user_id ${seed} AND kind IN ('LIKE', 'COMMENT', 'POST_WRITE');
  DELETE FROM score_events WHERE kind = 'LIKE_RECEIVED';
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at)
    SELECT user_id, 'LIKE', post_id, 0, 2, created_at FROM post_likes WHERE user_id ${seed};
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at, revoked_at)
    SELECT user_id, 'COMMENT', id, 0, IF(rn <= 10, 5, 0), created_at, IF(status = 'HIDDEN', hidden_at, NULL) FROM (
      SELECT c.id, c.user_id, c.status, c.hidden_at, c.created_at,
        ROW_NUMBER() OVER (PARTITION BY c.user_id, DATE(c.created_at + INTERVAL 9 HOUR) ORDER BY c.created_at, c.id) rn
      FROM comments c WHERE c.user_id ${seed} AND c.status IN ('VISIBLE', 'HIDDEN')) x;
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at, revoked_at)
    SELECT user_id, 'POST_WRITE', post_id, 0, IF(rn <= 3, 10, 0), created_at, IF(status = 'HIDDEN', hidden_at, NULL) FROM (
      SELECT cp.post_id, cp.user_id, cp.status, cp.hidden_at, cp.created_at,
        ROW_NUMBER() OVER (PARTITION BY cp.user_id, DATE(cp.created_at + INTERVAL 9 HOUR) ORDER BY cp.created_at, cp.post_id) rn
      FROM community_posts cp WHERE cp.user_id ${seed} AND cp.status <> 'DELETED') x;
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at)
    SELECT author, 'LIKE_RECEIVED', post_id, liker, 1, created_at FROM (
      SELECT cp.user_id author, l.post_id, l.user_id liker, l.created_at,
        ROW_NUMBER() OVER (PARTITION BY cp.user_id, DATE(l.created_at + INTERVAL 9 HOUR) ORDER BY l.created_at, l.post_id, l.user_id) rn
      FROM post_likes l JOIN community_posts cp ON cp.post_id = l.post_id
      WHERE cp.user_id IS NOT NULL AND cp.status <> 'DELETED' AND cp.user_id <> l.user_id) x WHERE rn <= 50;
  UPDATE users u LEFT JOIN (SELECT user_id, SUM(points) s FROM score_events WHERE revoked_at IS NULL GROUP BY user_id) e ON e.user_id = u.id
    SET u.score = IFNULL(e.s, 0), u.updated_at = u.updated_at WHERE u.score <> IFNULL(e.s, 0);

  SET @posts = (SELECT COUNT(*) FROM community_posts WHERE status = 'VISIBLE');
  SET @comments = (SELECT COUNT(*) FROM comments c JOIN community_posts cp ON cp.post_id = c.post_id WHERE c.status = 'VISIBLE' AND cp.status = 'VISIBLE');
  SET @likes = (SELECT COUNT(*) FROM post_likes l JOIN community_posts cp ON cp.post_id = l.post_id WHERE cp.status = 'VISIBLE');
  ${fail(`@posts <> ${int(expected.posts)} OR @comments <> ${int(expected.comments)} OR @likes <> ${int(expected.likes)}`, 'totals differ from expected')}
  ${fail(`(SELECT COUNT(*) FROM community_posts cp LEFT JOIN community_search s ON s.post_id = cp.post_id WHERE cp.status <> 'DELETED' AND s.post_id IS NULL) > 0`, 'search index missing')}
  ${fail(`(SELECT COUNT(*) FROM community_posts cp LEFT JOIN comments c ON c.id = cp.accepted_comment_id WHERE cp.accepted_comment_id IS NOT NULL AND (c.id IS NULL OR c.post_id <> cp.post_id OR c.parent_id IS NOT NULL OR c.user_id = cp.user_id)) > 0`, 'bad accept')}
  ${fail(`(SELECT COUNT(*) FROM comments c LEFT JOIN comments par ON par.id = c.parent_id WHERE c.parent_id IS NOT NULL AND par.id IS NULL) > 0`, 'orphan reply')}
  ${fail(`(SELECT COUNT(*) FROM posts WHERE url LIKE 'internal:community:%') > 0`, 'temporary url left')}
  ${fail(`(SELECT COUNT(*) FROM users WHERE id ${seed} AND created_at >= '2026-10-26') > 0`, 'seed user created_at')}
  IF @dry THEN ROLLBACK; ELSE COMMIT; END IF;
END main;
IF @fail IS NOT NULL THEN ROLLBACK; END IF;
SELECT IF(@fail IS NULL, IF(@dry, 'DRY RUN (rolled back)', 'COMMITTED'), CONCAT('ROLLED BACK: ', @fail)) AS result, @posts AS posts, @comments AS comments, @likes AS likes,
  @skipped_comments AS skipped_comments, @kept_real_likes AS posts_over_likes_after;
END //`);
push(`DELIMITER ;`);

process.stdout.write(out.join('\n') + '\n');
