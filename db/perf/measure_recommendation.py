import os
import re
import subprocess
import sys

DB = os.environ.get('PERF_DB', 'devfeed_perf')
RUNS = int(os.environ.get('RUNS', '20'))
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'queries', 'recommendation.sql')


def statements():
    text = open(SRC, encoding='utf-8').read()
    blocks = {}
    for block in text.strip().split('\n\n'):
        lines = block.split('\n')
        blocks[lines[0]] = '\n'.join(lines[1:]).strip().rstrip(';')
    pref = next(v for k, v in blocks.items() if 'step 1' in k)
    cand = next(v for k, v in blocks.items() if 'step 2' in k)
    return pref, cand


def mysql(sql):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                         input=sql, capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr[:2000])
    return out.stdout


def times(stdout):
    pattern = r'(?ms)^\{\s*\n(?:\s*"query_optimization": \{\s*"r_total_time_ms": ([\d.]+)\s*\},)?\s*"query_block": \{.*?"r_total_time_ms": ([\d.]+)'
    return [float(o or 0) + float(e) for o, e in re.findall(pattern, stdout)]


def main():
    pref, cand = statements()
    picks = mysql("""
SELECT user_id FROM (SELECT user_id, COUNT(*) c FROM read_histories WHERE last_read_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY GROUP BY user_id) x ORDER BY c DESC LIMIT 1;
SELECT user_id FROM (SELECT user_id, COUNT(*) c, ROW_NUMBER() OVER (ORDER BY COUNT(*)) rn, COUNT(*) OVER () n FROM read_histories WHERE last_read_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY GROUP BY user_id) x WHERE rn = n DIV 2;
SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM read_histories r WHERE r.user_id = u.id AND r.last_read_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY) LIMIT 1;
""").split()
    labels = ['최다 활동', '중간', '최근 30일 읽기 없음']
    print('| 회원 | 선호 태그 수 | 후보 수 | 선호도 p50/p95 ms | 후보 점수 p50/p95 ms |\n|---|---|---|---|---|')
    for label, uid in zip(labels, picks):
        setup = f"SET @uid = {uid};\nDROP TEMPORARY TABLE IF EXISTS tmp_tag_weights;\nCREATE TEMPORARY TABLE tmp_tag_weights {pref};\n"
        counts = mysql(setup + f"SELECT COUNT(*) FROM tmp_tag_weights;\nSELECT COUNT(*) FROM ({cand}) c;\n").split()
        out = mysql(setup + ''.join(f"ANALYZE FORMAT=JSON {pref};\n" for _ in range(RUNS + 1))
                    + ''.join(f"ANALYZE FORMAT=JSON {cand};\n" for _ in range(RUNS + 1)))
        t = times(out)
        a, b = sorted(t[1:RUNS + 1]), sorted(t[RUNS + 2:])
        p = lambda xs: f"{xs[len(xs) // 2]:.1f} / {xs[int(len(xs) * 0.95)]:.1f}"
        print(f"| {label} (id {uid}) | {counts[0]} | {counts[1]} | {p(a)} | {p(b)} |")


if __name__ == '__main__':
    main()
