const { openDb, pct } = require('./_db');
const API = 'http://localhost:3100/api';
const ITER = Number(process.env.ITER || 50);

(async () => {
  const { ds } = await openDb('devfeed_perf');
  const [{ total }] = await ds.query("SELECT COUNT(*) total FROM community_posts WHERE status = 'VISIBLE'");
  const [busy] = await ds.query(
    "SELECT p.id, p.comment_count FROM community_posts cp JOIN posts p ON p.id = cp.post_id WHERE cp.status = 'VISIBLE' ORDER BY p.comment_count DESC, p.id DESC LIMIT 1",
  );
  const ids = (await ds.query("SELECT post_id FROM community_posts WHERE status = 'VISIBLE' ORDER BY post_id DESC LIMIT 200")).map((r) => Number(r.post_id));
  console.log(`visible community posts=${total} busyPost=${busy.id}(${busy.comment_count} comments)`);

  const email = `perf-community-${Date.now()}@devfeed.test`;
  const headers = { 'content-type': 'application/json' };
  const signup = await (await fetch(`${API}/auth/signup`, { method: 'POST', headers, body: JSON.stringify({ email, password: 'pass1234', nickname: '측정' }) })).json();
  const auth = { ...headers, authorization: `Bearer ${signup.accessToken}` };
  const userId = signup.user.id;
  try {
    const timed = async (path, concurrency, pick, h = auth) => {
      const times = [];
      let n = 0;
      for (let i = 0; i < ITER; i++) {
        await Promise.all(Array.from({ length: concurrency }, async () => {
          const target = pick ? pick(n++) : path;
          const s = performance.now();
          const res = await fetch(`${API}${target}`, { headers: h });
          await res.arrayBuffer();
          if (res.status >= 400) throw new Error(`${target} ${res.status}`);
          times.push(performance.now() - s);
        }));
      }
      return times;
    };
    const row = (name, a, b) => console.log(`${name} | ${pct(a, 0.95).toFixed(1)} | ${pct(b, 0.95).toFixed(1)}`);
    console.log('case | c=1 p95 | c=10 p95 (ms)');
    await timed('/community/posts', 1);
    row('최신 목록(회원)', await timed('/community/posts?size=20', 1), await timed('/community/posts?size=20', 10));
    row('최신 목록(비회원)', await timed('/community/posts?size=20', 1, null, headers), await timed('/community/posts?size=20', 10, null, headers));
    row('말머리 QUESTION', await timed('/community/posts?category=QUESTION&size=20', 1), await timed('/community/posts?category=QUESTION&size=20', 10));
    row('인기 MONTH', await timed('/community/popular?period=MONTH', 1), await timed('/community/popular?period=MONTH', 10));
    row('상세', await timed(null, 1, (i) => `/community/posts/${ids[i % ids.length]}`), await timed(null, 10, (i) => `/community/posts/${ids[i % ids.length]}`));
    row('상세 댓글 첫 페이지(최다 글)', await timed(`/posts/${busy.id}/comments`, 1), await timed(`/posts/${busy.id}/comments`, 10));
    row('작성 가능 여부', await timed('/community/write-status', 1), await timed('/community/write-status', 10));
  } finally {
    await fetch(`${API}/me/withdraw`, { method: 'POST', headers: auth, body: JSON.stringify({ password: 'pass1234' }) });
    const [{ remaining }] = await ds.query('SELECT COUNT(*) remaining FROM users WHERE id = ?', [userId]);
    console.log(`측정 회원 탈퇴, 남은 행 ${remaining}`);
    await ds.destroy();
  }
})();
