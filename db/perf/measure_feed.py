import json, subprocess, sys
A, I = "'2026-11-18 10:15:36.000'", 99800
def cur(a='p.published_at', i='p.id'):
    return f"({a} < {A} OR ({a} = {A} AND {i} < {I}))"
def src_sub(s): return f"(SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE p.source_id = {s} AND {cur()} ORDER BY p.published_at DESC, p.id DESC LIMIT 21)"
def tag_sub(t, extra=''):
    return f"(SELECT pt.post_id AS id, pt.published_at AS published_at FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.tag_id = {t} AND {cur('pt.published_at','pt.post_id')}{extra} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21)"
def wrap(subs, op): return f"SELECT id, published_at FROM ({f' {op} '.join(subs)}) f ORDER BY published_at DESC, id DESC LIMIT 21"
ids20 = ','.join(str(99800 - k) for k in range(20))
Q = [
 ("최신 피드 다음 페이지", f"SELECT p.id, p.published_at FROM posts p WHERE {cur()} ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
 ("최신 피드, 1년 전 커서", f"SELECT p.id, p.published_at FROM posts p WHERE (p.published_at < '2025-11-18' OR (p.published_at = '2025-11-18' AND p.id < 99800)) ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
 ("sourceType PERSONAL (5%)", f"SELECT p.id, p.published_at FROM posts p WHERE p.source_type = 'PERSONAL' AND {cur()} ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
 ("sourceIds 3개 큰 소스 (12,8,21)", wrap([src_sub(s) for s in (12, 8, 21)], 'UNION ALL')),
 ("sourceIds 2개 작은 소스 (19,7)", wrap([src_sub(s) for s in (19, 7)], 'UNION ALL')),
 ("tagIds 1개 인기 (28)", f"SELECT pt.post_id, pt.published_at FROM post_tags pt WHERE pt.tag_id = 28 AND {cur('pt.published_at','pt.post_id')} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21"),
 ("tagIds 1개 희소 (84)", f"SELECT pt.post_id, pt.published_at FROM post_tags pt WHERE pt.tag_id = 84 AND {cur('pt.published_at','pt.post_id')} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21"),
 ("tagIds 3개 + COMPANY", wrap([tag_sub(t, " AND p.source_type = 'COMPANY'") for t in (28, 72, 23)], 'UNION')),
 ("tagIds 3개 + PERSONAL (최악: 유형 희소)", wrap([tag_sub(t, " AND p.source_type = 'PERSONAL'") for t in (28, 72, 23)], 'UNION')),
 ("tagIds 2개 + 작은 소스 3개 (최악)", wrap([tag_sub(t, " AND p.source_id IN (19, 7, 31)") for t in (28, 72)], 'UNION')),
 ("카드: posts JOIN sources", f"SELECT p.*, s.name FROM posts p JOIN sources s ON s.id = p.source_id WHERE p.id IN ({ids20})"),
 ("카드: post_tags JOIN tags", f"SELECT pt.post_id, t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id IN ({ids20}) ORDER BY pt.post_id, pt.tag_rank"),
 ("플래그: bookmarks", f"SELECT post_id FROM bookmarks WHERE user_id = 77 AND post_id IN ({ids20})"),
 ("플래그: read_histories", f"SELECT post_id FROM read_histories WHERE user_id = 77 AND post_id IN ({ids20})"),
 ("인기 글 MONTH", "SELECT id FROM posts WHERE published_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY ORDER BY view_count DESC, published_at DESC, id DESC LIMIT 20"),
]
RUNS = 20
sql = [f"ANALYZE FORMAT=JSON {q};" for _, q in Q for _ in range(RUNS + 2)]
out = subprocess.run(['docker','exec','-i','-e','MYSQL_PWD','mariadb','mariadb','-uroot','-N','-B','-r','devfeed_perf'], input='\n'.join(sql), capture_output=True, text=True)
if out.returncode: print(out.stderr[:2000]); sys.exit(1)
dec = json.JSONDecoder(); s = out.stdout; pos = 0; docs = []
while True:
    while pos < len(s) and s[pos].isspace(): pos += 1
    if pos >= len(s): break
    o, pos = dec.raw_decode(s, pos); docs.append(o)
def walk(o, acc):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == 'table' and isinstance(v, dict):
                acc['rows'] += v.get('r_rows', 0) * v.get('r_loops', 1)
                if v.get('key'): acc['keys'].append(v['key'])
            if k in ('filesort', 'temporary_table'): acc['flags'].add(k)
            walk(v, acc)
    elif isinstance(o, list):
        for x in o: walk(x, acc)
print('| 쿼리 | p50 ms | p95 ms | 읽은 행 | 인덱스 | 비고 |\n|---|---|---|---|---|---|')
for i, (t, _) in enumerate(Q):
    chunk = docs[i*(RUNS+2):(i+1)*(RUNS+2)][2:]
    times = sorted(d['query_block'].get('r_total_time_ms', 0) for d in chunk)
    acc = {'rows': 0, 'keys': [], 'flags': set()}; walk(chunk[0], acc)
    keys = ', '.join(sorted(set(acc['keys'])))
    print(f"| {t} | {times[len(times)//2]:.2f} | {times[int(len(times)*0.95)]:.2f} | {int(acc['rows'])} | {keys} | {', '.join(sorted(acc['flags']))} |")
