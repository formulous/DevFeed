import json, re, subprocess, sys

DB = sys.argv[1] if len(sys.argv) > 1 else 'devfeed_perf'
RUNS = 20


def run(sql):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                         input=sql, capture_output=True, text=True)
    if out.returncode:
        print(out.stderr[:2000]); sys.exit(1)
    return out.stdout


def one(sql):
    return run(sql).split()[0]


hot = one("SELECT id FROM posts ORDER BY comment_count DESC LIMIT 1;")
heavy_parent = one(f"SELECT id FROM comments WHERE post_id = {hot} AND parent_id IS NULL ORDER BY reply_count DESC LIMIT 1;")
liker = one("SELECT user_id FROM post_likes GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1;")
page = run("SELECT id FROM posts WHERE kind = 'BLOG' ORDER BY published_at DESC, id DESC LIMIT 20;").split()
liked_page = run(f"SELECT post_id FROM post_likes WHERE user_id = {liker} LIMIT 20;").split()
ids = ','.join(page)
lids = ','.join(liked_page + page[:0])
mid = one(f"SELECT id FROM comments WHERE post_id = {hot} AND parent_id IS NULL ORDER BY id LIMIT 1 OFFSET 1000;")
parents = run(f"SELECT id FROM comments WHERE post_id = {hot} AND parent_id IS NULL ORDER BY id LIMIT 20;").split()
pids = ','.join(parents)

Q = [
    ("카드 조립 + 카운터 (20건)", f"SELECT p.id, p.title, p.summary, p.view_count, p.like_count, p.comment_count, s.name FROM posts p JOIN sources s ON s.id = p.source_id WHERE p.id IN ({ids})"),
    ("likedByMe (20건)", f"SELECT post_id FROM post_likes WHERE user_id = {liker} AND post_id IN ({lids})"),
    ("댓글 첫 페이지 (댓글 많은 글)", f"SELECT c.id, c.user_id, c.body, c.status, c.reply_count, c.edited_at, c.created_at FROM comments c WHERE c.post_id = {hot} AND c.parent_id IS NULL ORDER BY c.id LIMIT 21"),
    ("댓글 1000개 뒤 커서", f"SELECT c.id FROM comments c WHERE c.post_id = {hot} AND c.parent_id IS NULL AND c.id > {mid} ORDER BY c.id LIMIT 21"),
    ("답글 처음 3개 x 부모 20개", f"SELECT id, parent_id FROM (SELECT c.id, c.parent_id, ROW_NUMBER() OVER (PARTITION BY c.parent_id ORDER BY c.id) rn FROM comments c WHERE c.parent_id IN ({pids})) r WHERE rn <= 4"),
    ("답글 더보기 (답글 많은 부모)", f"SELECT c.id FROM comments c WHERE c.parent_id = {heavy_parent} AND c.id > 0 ORDER BY c.id LIMIT 21"),
    ("작성자 닉네임 (80명)", f"SELECT u.id, u.nickname FROM users u WHERE u.id IN (SELECT DISTINCT user_id FROM comments WHERE parent_id IN ({pids}) OR id IN ({pids}))"),
    ("속도 제한: 최근 1분·24시간", f"SELECT SUM(created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE), COUNT(*) FROM comments WHERE user_id = {liker} AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 DAY"),
    ("정합성: 글 1건 좋아요 수 재계산", f"SELECT COUNT(*) FROM post_likes WHERE post_id = {hot}"),
]

out = run('\n'.join(f"ANALYZE FORMAT=JSON {q};" for _, q in Q for _ in range(RUNS + 2)))
blocks = [json.loads(b) for b in re.split(r'\n(?=\{)', out.strip())]


def walk(o, acc):
    if isinstance(o, dict):
        if isinstance(o.get('table'), dict):
            t = o['table']
            acc['rows'] += t.get('r_rows', 0) * t.get('r_loops', 1)
            if t.get('key'): acc['keys'].add(t['key'])
        for v in o.values(): walk(v, acc)
    elif isinstance(o, list):
        for x in o: walk(x, acc)


print('| 쿼리 | p50 ms | p95 ms | 읽은 행 | 인덱스 |\n|---|---|---|---|---|')
for i, (t, _) in enumerate(Q):
    chunk = blocks[i * (RUNS + 2):(i + 1) * (RUNS + 2)][2:]
    times = sorted(b['query_block']['r_total_time_ms'] for b in chunk)
    acc = {'rows': 0, 'keys': set()}; walk(chunk[0], acc)
    print(f"| {t} | {times[len(times) // 2]:.2f} | {times[int(len(times) * 0.95)]:.2f} | {int(acc['rows'])} | {', '.join(sorted(acc['keys']))} |")
