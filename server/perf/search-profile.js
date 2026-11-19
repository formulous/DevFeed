// 검색 쿼리 단계별 DB 시간 분해 (devfeed_perf, 읽기 전용)
const path = require('path');
const { openDb, pct, root } = require('./_db');
(async () => {
  const { ds } = await openDb('devfeed_perf');
  const M = 'MATCH(s.title_tokens, s.body_tokens) AGAINST (? IN BOOLEAN MODE)';
  const T = 'MATCH(s.title_tokens) AGAINST (? IN BOOLEAN MODE)';
  for (const [term, m] of [['개발', '+개발'], ['쿠버네티스 PHRASE', '+"쿠버 버네 네티 티스"'], ['쿠버네티스 ALL', '+쿠버 +버네 +네티 +티스']]) {
    const variants = {
      'count only': [`SELECT COUNT(*) c FROM post_search s WHERE ${M}`, [m]],
      'count capped 1001': [`SELECT COUNT(*) c FROM (SELECT 1 FROM post_search s WHERE ${M} LIMIT 1001) x`, [m]],
      'ids only (no order)': [`SELECT s.post_id FROM post_search s WHERE ${M} LIMIT 20`, [m]],
      'rank 1 MATCH, no join': [`SELECT s.post_id, ${M} sc FROM post_search s WHERE ${M} ORDER BY sc DESC LIMIT 20`, [m, m]],
      'rank 2 MATCH, no join': [`SELECT s.post_id, ${T}*2+${M} sc FROM post_search s WHERE ${M} ORDER BY sc DESC LIMIT 20`, [m, m, m]],
      'rank 2 MATCH + join (current)': [`SELECT p.id, ${T}*2+${M} sc FROM post_search s JOIN posts p ON p.id=s.post_id WHERE ${M} ORDER BY sc DESC, p.published_at DESC, p.id DESC LIMIT 20`, [m, m, m]],
      'latest + join (current)': [`SELECT p.id FROM post_search s JOIN posts p ON p.id=s.post_id WHERE ${M} ORDER BY p.published_at DESC, p.id DESC LIMIT 20`, [m]],
      'latest + join offset 980': [`SELECT p.id FROM post_search s JOIN posts p ON p.id=s.post_id WHERE ${M} ORDER BY p.published_at DESC, p.id DESC LIMIT 20 OFFSET 980`, [m]],
    };
    const times = Object.fromEntries(Object.keys(variants).map((k) => [k, []]));
    for (let round = 0; round < 6; round++) {
      const keys = Object.keys(variants); if (round % 2) keys.reverse();
      for (const k of keys) { const [sql, p] = variants[k]; const t0 = performance.now(); await ds.query(sql, p); times[k].push(performance.now() - t0); }
    }
    console.log(`== ${term}`);
    for (const [k, t] of Object.entries(times)) console.log(`  ${k.padEnd(32)} p50 ${pct(t, .5).toFixed(1).padStart(7)}  max ${Math.max(...t).toFixed(1).padStart(7)}`);
  }
  await ds.destroy();
})();
