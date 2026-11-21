const { openDb, pct } = require('./_db');
const API = 'http://localhost:3100/api';
const ITER = Number(process.env.ITER || 30);

(async () => {
  const { ds } = await openDb('devfeed_perf');
  const [{ n }] = await ds.query('SELECT COUNT(*) n FROM posts');
  const [{ likes }] = await ds.query('SELECT COUNT(*) likes FROM post_likes');
  const [{ comments }] = await ds.query('SELECT COUNT(*) comments FROM comments');
  const [busy] = await ds.query('SELECT post_id, COUNT(*) c FROM comments WHERE parent_id IS NULL GROUP BY post_id ORDER BY c DESC LIMIT 1');
  const tag = Number((await ds.query('SELECT tag_id FROM post_tags GROUP BY tag_id ORDER BY COUNT(*) DESC LIMIT 1'))[0].tag_id);
  const [liker] = await ds.query('SELECT user_id, COUNT(*) c FROM post_likes GROUP BY user_id ORDER BY c DESC LIMIT 1');
  await ds.destroy();
  console.log(`posts=${n} likes=${likes} comments=${comments} busyPost=${busy?.post_id}(${busy?.c}) topLiker=${liker?.user_id}(${liker?.c})`);

  const email = `perf-reactions-${Date.now()}@devfeed.test`;
  const signup = await (await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'pass1234', nickname: '측정' }) })).json();
  const token = signup.accessToken;
  const cases = [
    ['최신 피드', '/posts?size=20'],
    ['태그 피드', `/posts?size=20&tagIds=${tag}`],
    ['분야 피드', '/posts?size=20&field=BACKEND'],
    ['인기 글 주간', '/posts/popular?period=WEEK'],
    ['검색 "개발"', `/search?q=${encodeURIComponent('개발')}`],
    ['보안 뉴스', '/security-news?size=20'],
    ['댓글 첫 페이지(최다 글)', `/posts/${busy.post_id}/comments`],
  ];
  const run = async (path, auth, concurrency) => {
    const times = [];
    for (let i = 0; i < ITER; i++) {
      await Promise.all(Array.from({ length: concurrency }, async () => {
        const s = performance.now();
        const res = await fetch(`${API}${path}`, { headers: auth ? { authorization: `Bearer ${token}` } : {} });
        await res.arrayBuffer();
        if (res.status !== 200) throw new Error(`${path} ${res.status}`);
        times.push(performance.now() - s);
      }));
    }
    return times;
  };
  console.log('case | 게스트 c=1 p95 | 회원 c=1 p95 | 회원 c=10 p95 (ms)');
  for (const [name, path] of cases) {
    await run(path, true, 1);
    const g = await run(path, false, 1);
    const m = await run(path, true, 1);
    const m10 = await run(path, true, 10);
    console.log(`${name} | ${pct(g, 0.95).toFixed(1)} | ${pct(m, 0.95).toFixed(1)} | ${pct(m10, 0.95).toFixed(1)}`);
  }
  await fetch(`${API}/me/withdraw`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pass1234' }) });
})().catch((e) => { console.error(e); process.exit(1); });
