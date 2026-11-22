import json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_posts import tokenize

DB = os.environ.get('PERF_DB', 'devfeed_perf')
RUNS = 10
TERMS = os.environ.get('TERMS', '취약점|코드|쿠버네티스|react 상태 관리|랜섬웨어|존재하지않는검색어').split('|')


def run(sql):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                         input=sql, capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr[:2000])
    return out.stdout


dom = ','.join(run("SELECT id FROM sources WHERE kind = 'SECURITY_NEWS' AND region = 'DOMESTIC';").split())


def lit(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "''") + "'"


def queries(term):
    bq = lit(' '.join('+' + t for t in dict.fromkeys(tokenize(term))))
    out = []
    for scope, table in (('보안', 'security_news_search'), ('자유', 'community_search')):
        m = f"MATCH(s.title_tokens, s.body_tokens) AGAINST({bq} IN BOOLEAN MODE)"
        score = f"MATCH(s.title_tokens) AGAINST({bq} IN BOOLEAN MODE) * 2 + {m}"
        if scope == '보안':
            plain = f"FROM {table} s WHERE {m}"
            joined = f"FROM {table} s JOIN posts p FORCE INDEX (idx_posts_search_filter) ON p.id = s.post_id WHERE {m}"
            filt = f" AND p.source_id IN ({dom})"
        else:
            plain = f"FROM {table} s JOIN community_posts cp ON cp.post_id = s.post_id AND cp.status = 'VISIBLE' WHERE {m}"
            joined = plain
            filt = " AND cp.category = 'QUESTION'"
        out += [
            (f"{scope} 관련도", f"SELECT s.post_id, {score} AS score {plain} ORDER BY score DESC, s.post_id DESC LIMIT 20"),
            (f"{scope} 관련도 + 필터", f"SELECT s.post_id, {score} AS score {joined}{filt} ORDER BY score DESC, s.post_id DESC LIMIT 20"),
            (f"{scope} 최신순", f"SELECT s.post_id {joined.replace('JOIN community_posts cp', 'JOIN community_posts cp')} ORDER BY {'p.published_at DESC, p.id DESC' if scope == '보안' else 'cp.published_at DESC, cp.post_id DESC'} LIMIT 20"),
            (f"{scope} 건수 (상한 1000)", f"SELECT COUNT(*) FROM (SELECT 1 {plain} LIMIT 1001) c"),
        ]
    return out


labels, sqls = [], []
for term in TERMS:
    for label, q in queries(term):
        labels.append((term, label)); sqls.append(q)
out = run('\n'.join(f"ANALYZE FORMAT=JSON {q};" for q in sqls for _ in range(RUNS + 1)))
pattern = r'(?ms)^\{\s*\n(?:\s*"query_optimization": \{\s*"r_total_time_ms": ([\d.]+)\s*\},)?\s*"query_block": \{.*?"r_total_time_ms": ([\d.]+)'
times = [float(o or 0) + float(e) for o, e in re.findall(pattern, out)]
if len(times) != len(sqls) * (RUNS + 1):
    sys.exit(f'parsed {len(times)}')
agg = {}
for i, key in enumerate(labels):
    ts = sorted(times[i * (RUNS + 1) + 1:(i + 1) * (RUNS + 1)])
    agg.setdefault(key[1], []).append((ts[len(ts) // 2], ts[-1], key[0]))
print('| 쿼리 | 검색어별 p50 최대 ms | 최악 ms (검색어) |\n|---|---|---|')
for label, rows in agg.items():
    worst = max(rows, key=lambda r: r[1])
    print(f"| {label} | {max(r[0] for r in rows):.1f} | {worst[1]:.1f} ({worst[2]}) |")
