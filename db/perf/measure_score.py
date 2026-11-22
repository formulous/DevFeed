import json, re, subprocess, sys

DB = sys.argv[1] if len(sys.argv) > 1 else 'devfeed_perf'
RUNS = 20


def run(sql):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                         input=sql, capture_output=True, text=True)
    if out.returncode:
        print(out.stderr[:2000]); sys.exit(1)
    return out.stdout


uid = run("SELECT user_id FROM read_histories GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1;").split()[0]
hot = run("SELECT id FROM posts ORDER BY comment_count DESC LIMIT 1;").split()[0]
Q = [
    ("프로필 (점수 + 수치 4개, 활동 많은 회원)", f"SELECT u.nickname, u.score, (SELECT COUNT(*) FROM post_likes WHERE user_id = u.id) a, (SELECT COUNT(*) FROM comments WHERE user_id = u.id AND status = 'VISIBLE') b, (SELECT COUNT(*) FROM read_histories WHERE user_id = u.id) c, (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id) d FROM users u WHERE u.id = {uid}"),
    ("댓글 첫 페이지 + 작성자 등급 점수", f"SELECT c.id, c.body, u.nickname, u.score FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.post_id = {hot} AND c.parent_id IS NULL ORDER BY c.id LIMIT 21"),
    ("하루 읽기 한도 합계", f"SELECT COUNT(*) FROM score_events WHERE user_id = {uid} AND kind = 'READ' AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 DAY"),
    ("하루 댓글 한도 합계", f"SELECT COUNT(*) FROM score_events WHERE user_id = {uid} AND kind = 'COMMENT' AND created_at >= UTC_TIMESTAMP(3) - INTERVAL 1 DAY"),
    ("회원 1명 원장 합계 (점검)", f"SELECT SUM(points) FROM score_events WHERE user_id = {uid} AND revoked_at IS NULL"),
]
out = run('\n'.join(f"ANALYZE FORMAT=JSON {q};" for _, q in Q for _ in range(RUNS + 2)))
blocks = [json.loads(b) for b in re.split(r'\n(?=\{)', out.strip())]
print('| 쿼리 | p50 ms | p95 ms |\n|---|---|---|')
for i, (t, _) in enumerate(Q):
    times = sorted(b['query_block']['r_total_time_ms'] for b in blocks[i * (RUNS + 2):(i + 1) * (RUNS + 2)][2:])
    print(f"| {t} | {times[len(times) // 2]:.2f} | {times[int(len(times) * 0.95)]:.2f} |")
