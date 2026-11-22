import json, re, subprocess, sys

DB = sys.argv[1] if len(sys.argv) > 1 else 'devfeed_perf'
RUNS = 20


def run(sql):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                         input=sql, capture_output=True, text=True)
    if out.returncode:
        print(out.stderr[:2000]); sys.exit(1)
    return out.stdout


uid = run("SELECT user_id FROM community_posts WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1;").split()[0]
at, cid = run("SELECT published_at, post_id FROM community_posts WHERE status = 'VISIBLE' ORDER BY published_at DESC, post_id DESC LIMIT 1 OFFSET 2000;").split('\t')
cid = cid.strip()
cur = f"(cp.published_at < '{at}' OR (cp.published_at = '{at}' AND cp.post_id < {cid}))"
pop = lambda n, cat='': (f"SELECT p.id, p.like_count * 2 + p.comment_count + p.view_count * 0.1 AS score FROM community_posts cp JOIN posts p ON p.id = cp.post_id "
                         f"WHERE cp.status = 'VISIBLE'{cat} AND cp.published_at >= UTC_TIMESTAMP(3) - INTERVAL {n} DAY ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20")
Q = [
    ("최신 첫 페이지", "SELECT cp.post_id FROM community_posts cp WHERE cp.status = 'VISIBLE' ORDER BY cp.published_at DESC, cp.post_id DESC LIMIT 21"),
    ("최신 2,000개 뒤 커서", f"SELECT cp.post_id FROM community_posts cp WHERE cp.status = 'VISIBLE' AND {cur} ORDER BY cp.published_at DESC, cp.post_id DESC LIMIT 21"),
    ("말머리 QUESTION 커서", f"SELECT cp.post_id FROM community_posts cp WHERE cp.status = 'VISIBLE' AND cp.category = 'QUESTION' AND {cur} ORDER BY cp.published_at DESC, cp.post_id DESC LIMIT 21"),
    ("카드 20건 (posts + 확장 + 작성자)", "SELECT p.id, p.title, p.summary, p.like_count, p.comment_count, p.view_count, cp.category, cp.accepted_comment_id IS NOT NULL solved, u.nickname, u.score "
     "FROM posts p JOIN community_posts cp ON cp.post_id = p.id LEFT JOIN users u ON u.id = cp.user_id WHERE p.id IN (SELECT post_id FROM (SELECT post_id FROM community_posts WHERE status = 'VISIBLE' ORDER BY published_at DESC LIMIT 20) x)"),
    ("상세 (본문 포함)", f"SELECT cp.body, cp.status, cp.accepted_comment_id FROM community_posts cp WHERE cp.post_id = {cid}"),
    ("인기 DAY", pop(1)), ("인기 WEEK", pop(7)), ("인기 MONTH", pop(30)), ("인기 MONTH + 말머리", pop(30, " AND cp.category = 'SHARE'")),
    ("작성 제한: 오늘 글 수·마지막 작성", f"SELECT COUNT(*), MAX(created_at) FROM score_events WHERE user_id = {uid} AND kind = 'POST_WRITE' AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 DAY"),
    ("프로필 글 수", f"SELECT COUNT(*) FROM community_posts WHERE user_id = {uid} AND status = 'VISIBLE'"),
    ("신고 대기 목록", "SELECT target_type, target_id, report_count FROM report_targets WHERE state = 'PENDING' ORDER BY last_reported_at DESC LIMIT 21"),
]
out = run('\n'.join(f"ANALYZE FORMAT=JSON {q};" for _, q in Q for _ in range(RUNS + 2)))
blocks = [json.loads(b) for b in re.split(r'\n(?=\{)', out.strip())]


def walk(o, acc):
    if isinstance(o, dict):
        if isinstance(o.get('table'), dict):
            t = o['table']
            acc['rows'] += (t.get('r_rows') or 0) * (t.get('r_loops') or 1)
            if t.get('key'): acc['keys'].add(t['key'])
        for v in o.values(): walk(v, acc)
    elif isinstance(o, list):
        for x in o: walk(x, acc)


print('| 쿼리 | p50 ms | p95 ms | 읽은 행 | 인덱스 |\n|---|---|---|---|---|')
for i, (t, _) in enumerate(Q):
    chunk = blocks[i * (RUNS + 2):(i + 1) * (RUNS + 2)][2:]
    times = sorted(b['query_block'].get('r_total_time_ms', 0) for b in chunk)
    acc = {'rows': 0, 'keys': set()}; walk(chunk[0], acc)
    print(f"| {t} | {times[len(times) // 2]:.2f} | {times[int(len(times) * 0.95)]:.2f} | {int(acc['rows'])} | {', '.join(sorted(acc['keys']))} |")
