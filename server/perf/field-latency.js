const path = require('path');
const { openDb, pct, root } = require('./_db');

async function main() {
  const { ds } = await openDb(process.argv[2] ?? 'devfeed_perf');
  const { buildFeedQuery } = require(path.join(root, 'dist/posts/feed-query'));
  const { FIELDS, groupTagsByField } = require(path.join(root, 'dist/posts/fields'));
  const tags = await ds.query('SELECT id, category FROM tags WHERE category IS NOT NULL');
  const groups = groupTagsByField(tags.map((t) => ({ id: Number(t.id), category: t.category })));
  const cases = [];
  for (const field of FIELDS) {
    cases.push([`${field}`, { fieldTagIds: groups.get(field) }]);
    cases.push([`${field} + PERSONAL`, { fieldTagIds: groups.get(field), sourceType: 'PERSONAL' }]);
  }
  cases.push(['최신 (BLOG)', {}], ['보안 뉴스', { kind: 'SECURITY_NEWS' }]);
  for (const [label, filter] of cases) {
    const times = [];
    let rows = 0;
    for (let i = 0; i < 30; i++) {
      const { sql, params } = buildFeedQuery({ ...filter, limit: 21 });
      const start = process.hrtime.bigint();
      rows = (await ds.query(sql, params)).length;
      times.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    console.log(`${label.padEnd(22)} rows=${String(rows).padStart(2)} p50=${pct(times, 0.5).toFixed(2)}ms p95=${pct(times, 0.95).toFixed(2)}ms`);
  }
  await ds.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
