// 검색 API 지연 측정. 측정 서버: DB_DATABASE=devfeed_perf CRAWL_SCHEDULER_ENABLED=false SEARCH_CACHE_ENABLED=false PORT=3100 node dist/main
const path = require('path');
const { openDb, pct, root } = require('./_db');
const { buildMatchQuery } = require(path.join(root, 'dist/ingest/tokenizer'));
const { buildSearchQueries } = require(path.join(root, 'dist/search/search-query'));
const API = 'http://localhost:3100/api/search';
const ITER = Number(process.env.ITER || 30);

(async () => {
  const { ds } = await openDb('devfeed_perf');
  const [{ n }] = await ds.query('SELECT COUNT(*) n FROM posts');
  const tag = Number((await ds.query('SELECT tag_id FROM post_tags GROUP BY tag_id ORDER BY COUNT(*) DESC LIMIT 1'))[0].tag_id);
  const src = Number((await ds.query('SELECT source_id FROM posts GROUP BY source_id ORDER BY COUNT(*) DESC LIMIT 1'))[0].source_id);
  const srcs5 = (await ds.query('SELECT source_id FROM posts GROUP BY source_id ORDER BY COUNT(*) DESC LIMIT 5')).map((r) => Number(r.source_id)).join(',');
  console.log(`posts=${n} topTag=${tag} topSource=${src}`);
  const cases = [
    ['흔한 한글 "개발"', 'q=개발'],
    ['흔한 한글 "서비스"', 'q=서비스'],
    ['중간 "쿠버네티스"', 'q=쿠버네티스'],
    ['중간 "카프카"', 'q=카프카'],
    ['드문 "리밸런싱"', 'q=리밸런싱'],
    ['2단어 "성능 개선"', 'q=성능 개선'],
    ['2단어 "테스트 코드"', 'q=테스트 코드'],
    ['영문 "react"', 'q=react'],
    ['영문 "java"', 'q=java'],
    ['개발 + 1M', 'q=개발&period=1M'],
    ['개발 + 태그 + 소스', `q=개발&tagIds=${tag}&sourceIds=${src}`],
    ['개발 + 1Y + 소스5', `q=개발&period=1Y&sourceIds=${srcs5}`],
    ['react + 태그', `q=react&tagIds=${tag}`],
    ['개발 최신순', 'q=개발&sort=LATEST'],
    ['개발 50페이지', 'q=개발&page=50'],
  ];
  const enc = (qs) => qs.split('&').map((kv) => { const [k, v] = kv.split('='); return `${k}=${encodeURIComponent(v)}`; }).join('&');
  const all1 = []; const all10 = [];
  console.log('\n[API] case | total | c=1 p50/p95 ms | c=10 p50/p95 ms');
  for (const [name, qs] of cases) {
    const url = `${API}?${enc(qs)}`;
    await fetch(url);
    const t1 = [];
    let total = 0;
    for (let i = 0; i < ITER; i++) {
      const t0 = performance.now(); const r = await fetch(url); const body = await r.json(); t1.push(performance.now() - t0);
      if (r.status !== 200) throw new Error(`${url} ${r.status} ${JSON.stringify(body)}`);
      total = body.total;
    }
    const t10 = [];
    await Promise.all(Array.from({ length: 10 }, async () => {
      for (let i = 0; i < ITER; i++) { const t0 = performance.now(); await (await fetch(url)).json(); t10.push(performance.now() - t0); }
    }));
    all1.push(...t1); all10.push(...t10);
    console.log(`${name.padEnd(18)} | ${String(total).padStart(6)} | ${pct(t1, .5).toFixed(1)}/${pct(t1, .95).toFixed(1)} | ${pct(t10, .5).toFixed(1)}/${pct(t10, .95).toFixed(1)}`);
  }
  console.log(`ALL c=1 n=${all1.length} p50=${pct(all1, .5).toFixed(1)} p95=${pct(all1, .95).toFixed(1)} max=${Math.max(...all1).toFixed(1)}`);
  console.log(`ALL c=10 n=${all10.length} p50=${pct(all10, .5).toFixed(1)} p95=${pct(all10, .95).toFixed(1)} max=${Math.max(...all10).toFixed(1)}`);

  await ds.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
