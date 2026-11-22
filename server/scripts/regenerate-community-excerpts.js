const path = require('path');
const { openDb, root } = require('../perf/_db');

async function main() {
  const [database, mode] = process.argv.slice(2);
  if (!database) throw new Error('사용법: node scripts/regenerate-community-excerpts.js <database> [--apply]');
  const { markdownExcerpt } = require(path.join(root, 'dist/community/markdown-excerpt'));
  const { ds } = await openDb(database);
  try {
    const rows = await ds.query(
      `SELECT p.id, p.summary, cp.body FROM posts p JOIN community_posts cp ON cp.post_id = p.id WHERE p.kind = 'COMMUNITY' ORDER BY p.id`,
    );
    const changed = rows
      .map((r) => ({ id: Number(r.id), before: r.summary, after: markdownExcerpt(r.body) }))
      .filter((r) => r.before !== r.after);
    for (const r of changed.slice(0, 5)) console.log(`#${r.id}\n  - ${r.before}\n  + ${r.after}`);
    console.log(`대상 ${rows.length}건, 바뀜 ${changed.length}건`);
    if (mode !== '--apply') return;
    await ds.transaction(async (m) => {
      for (const r of changed) await m.query('UPDATE posts SET summary = ? WHERE id = ? AND kind = ?', [r.after, r.id, 'COMMUNITY']);
    });
    console.log(`적용 ${changed.length}건`);
  } finally {
    await ds.destroy();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
