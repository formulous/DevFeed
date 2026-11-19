// 검색 정확성(정밀도·재현율). 개발 서버(:3000)와 개발 DB(devfeed) 대상, 읽기 전용
const path = require('path');
const { openDb, pct, root } = require('./_db');
const { buildMatchQuery } = require(path.join(root, 'dist/ingest/tokenizer'));
const norm = (s) => (s || '').normalize('NFKC').toLowerCase();
const QUERIES = ['리밸런싱', '쿠버네티스', '테스트 코드', 'kafka', '카프카 컨슈머', '성능 개선', '배포', '모니터링', '데이터베이스', 'react', '장애 대응', '코드 리뷰', '검색'];
(async () => {
  const { ds } = await openDb('devfeed');
  const posts = await ds.query(`SELECT p.id, p.title, p.summary, s.name source,
      (SELECT GROUP_CONCAT(CONCAT_WS(' ', t.name, (SELECT GROUP_CONCAT(x.synonym SEPARATOR ' ') FROM tag_synonyms x WHERE x.tag_id=t.id)) SEPARATOR ' ')
         FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=p.id) tagtext
    FROM posts p JOIN sources s ON s.id=p.source_id`);
  const docs = posts.map((p) => ({ id: Number(p.id), text: norm([p.title, p.summary, p.tagtext, p.source].join(' ')) }));
  console.log('query'.padEnd(10), 'truth', '| PHRASE n prec recall | ALL n prec recall | API total');
  for (const q of QUERIES) {
    const words = norm(q).split(/\s+/);
    const truth = new Set(docs.filter((d) => words.every((w) => d.text.includes(w))).map((d) => d.id));
    const out = [];
    for (const mode of ['PHRASE', 'ALL']) {
      const m = buildMatchQuery(q, mode);
      const ids = (await ds.query('SELECT post_id id FROM post_search WHERE MATCH(title_tokens, body_tokens) AGAINST (? IN BOOLEAN MODE)', [m])).map((r) => Number(r.id));
      const hit = ids.filter((id) => truth.has(id)).length;
      out.push(`${String(ids.length).padStart(4)} ${(ids.length ? hit / ids.length : 1).toFixed(2)} ${(truth.size ? hit / truth.size : 1).toFixed(2)}`);
    }
    const api = await (await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(q)}&size=1`)).json();
    console.log(q.padEnd(10), String(truth.size).padStart(5), '|', out[0], '|', out[1], '|', api.total);
  }
  await ds.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
