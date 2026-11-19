// 추천 API 지연 측정. 측정 서버는 search-latency.js와 같음. 노출 기록 행이 devfeed_perf에 추가됨
const path = require('path');
const { openDb, pct, root } = require('./_db');
const { createHmac } = require('node:crypto');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
let secret = '';
const sign = (sub) => { const h = b64({ alg: 'HS256', typ: 'JWT' }); const now = Math.floor(Date.now() / 1000); const p = b64({ sub, role: 'USER', iat: now, exp: now + 900 }); return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`; };
(async () => {
  const { ds, env } = await openDb('devfeed_perf');
  secret = env.jwt.accessSecret;
  const since = new Date(Date.now() - 30 * 86400000);
  const active = await ds.query('SELECT user_id id, COUNT(*) c FROM read_histories WHERE last_read_at >= ? GROUP BY user_id ORDER BY c DESC LIMIT 1', [since]);
  const median = await ds.query('SELECT user_id id, COUNT(*) c FROM read_histories WHERE last_read_at >= ? GROUP BY user_id ORDER BY c LIMIT 1 OFFSET 4000', [since]);
  const noRecent = await ds.query(`SELECT u.id FROM users u WHERE EXISTS (SELECT 1 FROM user_interest_tags t WHERE t.user_id=u.id)
     AND NOT EXISTS (SELECT 1 FROM read_histories h WHERE h.user_id=u.id AND h.last_read_at >= ?) LIMIT 1`, [since]);
  const cold = await ds.query(`SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_interest_tags t WHERE t.user_id=u.id)
     AND NOT EXISTS (SELECT 1 FROM read_histories h WHERE h.user_id=u.id AND h.last_read_at >= ?)
     AND NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id=u.id AND b.created_at >= ?) LIMIT 1`, [since, since]);
  const users = [['최다 활동', active[0]], ['중간', median[0]], ['최근 읽기 없음', noRecent[0]], ['콜드 스타트', cold[0]]].filter(([, u]) => u);
  const ITER = 30; const all1 = []; const allNext = [];
  console.log('user | 30d reads | fallback items | first page p50/p95 | next page p50/p95');
  for (const [name, u] of users) {
    const token = sign(Number(u.id));
    const t1 = []; const t2 = []; let info = '';
    for (let i = 0; i < ITER; i++) {
      let t0 = performance.now();
      const r = await fetch('http://localhost:3100/api/recommendations', { headers: { Authorization: `Bearer ${token}` } });
      const body = await r.json(); t1.push(performance.now() - t0);
      if (r.status !== 200) throw new Error(JSON.stringify(body));
      info = `${body.fallback} ${body.items.length}`;
      if (body.nextCursor) {
        t0 = performance.now();
        await (await fetch(`http://localhost:3100/api/recommendations?cursor=${encodeURIComponent(body.nextCursor)}`, { headers: { Authorization: `Bearer ${token}` } })).json();
        t2.push(performance.now() - t0);
      }
    }
    all1.push(...t1); allNext.push(...t2);
    console.log(`${name} (id ${u.id}) | ${u.c ?? 0} | ${info} | ${pct(t1, .5).toFixed(1)}/${pct(t1, .95).toFixed(1)} | ${t2.length ? `${pct(t2, .5).toFixed(1)}/${pct(t2, .95).toFixed(1)}` : '-'}`);
  }
  console.log(`ALL first page n=${all1.length} p50=${pct(all1, .5).toFixed(1)} p95=${pct(all1, .95).toFixed(1)} max=${Math.max(...all1).toFixed(1)}`);
  console.log(`ALL next page n=${allNext.length} p50=${pct(allNext, .5).toFixed(1)} p95=${pct(allNext, .95).toFixed(1)}`);
  const tokens = []; for (const r of await ds.query('SELECT id FROM users ORDER BY RAND() LIMIT 10')) tokens.push(sign(Number(r.id)));
  const t10 = [];
  await Promise.all(tokens.map(async (tk) => { for (let i = 0; i < 20; i++) { const t0 = performance.now(); await (await fetch('http://localhost:3100/api/recommendations', { headers: { Authorization: `Bearer ${tk}` } })).json(); t10.push(performance.now() - t0); } }));
  console.log(`c=10 (random users) first page n=${t10.length} p50=${pct(t10, .5).toFixed(1)} p95=${pct(t10, .95).toFixed(1)}`);
  await ds.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
