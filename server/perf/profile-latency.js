const { openDb, pct } = require('./_db');
const API = 'http://localhost:3100/api';
const ITER = Number(process.env.ITER || 50);

(async () => {
  const { ds } = await openDb('devfeed_perf');
  const [{ events }] = await ds.query('SELECT COUNT(*) events FROM score_events');
  const [busy] = await ds.query('SELECT post_id, COUNT(*) c FROM comments WHERE parent_id IS NULL GROUP BY post_id ORDER BY c DESC LIMIT 1');
  const postIds = (await ds.query("SELECT id FROM posts WHERE kind = 'BLOG' ORDER BY id DESC LIMIT 1200")).map((r) => Number(r.id));
  console.log(`score_events=${events} busyPost=${busy.post_id}(${busy.c})`);

  const email = `perf-profile-${Date.now()}@devfeed.test`;
  const headers = { 'content-type': 'application/json' };
  const signup = await (await fetch(`${API}/auth/signup`, { method: 'POST', headers, body: JSON.stringify({ email, password: 'pass1234', nickname: '측정' }) })).json();
  const token = signup.accessToken;
  const auth = { ...headers, authorization: `Bearer ${token}` };
  const userId = signup.user.id;
  try {
    await ds.query(
      `INSERT INTO read_histories (user_id, post_id, first_read_at, last_read_at)
       SELECT ?, id, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3) FROM posts WHERE id IN (${postIds.slice(0, 1000).join(',')})`,
      [userId],
    );
    await ds.query(
      `INSERT INTO bookmarks (user_id, post_id) SELECT ?, id FROM posts WHERE id IN (${postIds.slice(0, 300).join(',')})`,
      [userId],
    );
    for (const id of postIds.slice(0, 50)) await fetch(`${API}/posts/${id}/like`, { method: 'PUT', headers: auth });
    console.log('측정 회원: 읽은 기록 1,000 · 북마크 300 · 좋아요 50');

    const timed = async (method, path, concurrency, pick) => {
      const times = [];
      let n = 0;
      for (let i = 0; i < ITER; i++) {
        await Promise.all(Array.from({ length: concurrency }, async () => {
          const target = pick ? pick(n++) : path;
          const s = performance.now();
          const res = await fetch(`${API}${target}`, { method, headers: auth });
          await res.arrayBuffer();
          if (res.status >= 400) throw new Error(`${target} ${res.status}`);
          times.push(performance.now() - s);
        }));
      }
      return times;
    };
    const row = (name, a, b) => console.log(`${name} | ${pct(a, 0.95).toFixed(1)} | ${pct(b, 0.95).toFixed(1)}`);
    console.log('case | c=1 p95 | c=10 p95 (ms)');
    await timed('GET', '/me/profile', 1);
    row('프로필', await timed('GET', '/me/profile', 1), await timed('GET', '/me/profile', 10));
    row('조회(새 글, 점수 적립 경로)', await timed('POST', null, 1, (i) => `/posts/${postIds[1000 + (i % 100)]}/views`), await timed('POST', null, 10, (i) => `/posts/${postIds[1100 + (i % 100)]}/views`));
    row('조회(읽은 글)', await timed('POST', null, 1, (i) => `/posts/${postIds[i % 1000]}/views`), await timed('POST', null, 10, (i) => `/posts/${postIds[i % 1000]}/views`));
    row('좋아요 켜기·끄기', await timed('PUT', `/posts/${postIds[60]}/like`, 1), await timed('DELETE', `/posts/${postIds[60]}/like`, 10));
    row('최신 피드', await timed('GET', '/posts?size=20', 1), await timed('GET', '/posts?size=20', 10));
    row('댓글 첫 페이지(최다 글)', await timed('GET', `/posts/${busy.post_id}/comments`, 1), await timed('GET', `/posts/${busy.post_id}/comments`, 10));
  } finally {
    await fetch(`${API}/me/withdraw`, { method: 'POST', headers: auth, body: JSON.stringify({ password: 'pass1234' }) });
    const [{ remaining }] = await ds.query('SELECT COUNT(*) remaining FROM users WHERE id = ?', [userId]);
    console.log(`측정 회원 탈퇴, 남은 행 ${remaining}`);
    await ds.destroy();
  }
})().catch((e) => { console.error(e); process.exit(1); });
