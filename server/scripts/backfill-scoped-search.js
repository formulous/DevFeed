const path = require('path');
const { openDb, root } = require('../perf/_db');

const BATCH = 500;

async function main() {
  const [database, mode] = process.argv.slice(2);
  if (!database) throw new Error('사용법: node scripts/backfill-scoped-search.js <database> [--apply]');
  const apply = mode === '--apply';
  const { toTokenString } = require(path.join(root, 'dist/ingest/tokenizer'));
  const { indexCommunityPost } = require(path.join(root, 'dist/community/community-store'));
  const { ds } = await openDb(database);
  try {
    const [news] = await ds.query(
      `SELECT COUNT(*) AS total, SUM(s.post_id IS NULL) AS missing
         FROM posts p LEFT JOIN security_news_search s ON s.post_id = p.id WHERE p.kind = 'SECURITY_NEWS'`,
    );
    const [community] = await ds.query(
      `SELECT COUNT(*) AS total, SUM(s.post_id IS NULL) AS missing
         FROM community_posts cp LEFT JOIN community_search s ON s.post_id = cp.post_id WHERE cp.status <> 'DELETED'`,
    );
    console.log(`보안 뉴스 ${news.total}건 중 색인 없음 ${Number(news.missing ?? 0)}건`);
    console.log(`자유 게시판(삭제 제외) ${community.total}건 중 색인 없음 ${Number(community.missing ?? 0)}건`);
    if (!apply) return;

    let lastId = 0;
    let newsDone = 0;
    for (;;) {
      const rows = await ds.query(
        `SELECT p.id, p.title, p.summary, src.name AS source_name
           FROM posts p JOIN sources src ON src.id = p.source_id
          WHERE p.kind = 'SECURITY_NEWS' AND p.id > ? ORDER BY p.id LIMIT ?`,
        [lastId, BATCH],
      );
      if (!rows.length) break;
      await ds.transaction(async (m) => {
        for (const r of rows) {
          await m.query(
            `INSERT INTO security_news_search (post_id, title_tokens, body_tokens) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE title_tokens = VALUES(title_tokens), body_tokens = VALUES(body_tokens)`,
            [r.id, toTokenString(r.title), toTokenString(r.summary, r.source_name)],
          );
        }
      });
      newsDone += rows.length;
      lastId = Number(rows[rows.length - 1].id);
    }

    const ids = await ds.query("SELECT post_id FROM community_posts WHERE status <> 'DELETED' ORDER BY post_id");
    await ds.transaction(async (m) => {
      for (const { post_id } of ids) await indexCommunityPost(m, Number(post_id));
    });
    console.log(`적용: 보안 뉴스 ${newsDone}건, 자유 게시판 ${ids.length}건`);
  } finally {
    await ds.destroy();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
