import os, random, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_posts import token_string

DB = os.environ.get('PERF_DB', 'devfeed_perf')
BODY_LIMIT = 2000


def sql(text, out=True):
    r = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                       input=text, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[:2000])
    return [l.split('\t') for l in r.stdout.split('\n') if l] if out else None


def h(s):
    return "X'" + s.encode('utf-8').hex() + "'"


def load(table, rows):
    for i in range(0, len(rows), 300):
        chunk = rows[i:i + 300]
        values = ','.join(f"({pid},CONVERT({h(t)} USING utf8mb4),CONVERT({h(b)} USING utf8mb4))" for pid, t, b in chunk)
        sql(f"INSERT INTO {table} (post_id, title_tokens, body_tokens) VALUES {values} ON DUPLICATE KEY UPDATE title_tokens = VALUES(title_tokens), body_tokens = VALUES(body_tokens);", out=False)


news = sql("SELECT p.id, p.title, IFNULL(p.summary, ''), s.name FROM posts p JOIN sources s ON s.id = p.source_id WHERE p.kind = 'SECURITY_NEWS';")
load('security_news_search', [(int(i), token_string(t), token_string(sm, n)) for i, t, sm, n in news])

blog = sql("SELECT title, IFNULL(summary, '') FROM posts WHERE kind = 'BLOG' ORDER BY id LIMIT 20000;")
tags = {r[0]: r[1] for r in sql("SELECT pt.post_id, GROUP_CONCAT(t.name SEPARATOR ' ') FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.kind = 'COMMUNITY' GROUP BY pt.post_id;")}
community = sql("SELECT cp.post_id, p.title FROM community_posts cp JOIN posts p ON p.id = cp.post_id WHERE cp.status = 'VISIBLE';")
rows = []
for pid, title in community:
    rnd = random.Random(int(pid))
    body = ' '.join(f"{t} {s}" for t, s in rnd.sample(blog, rnd.randint(3, 25)))[:BODY_LIMIT]
    rows.append((int(pid), token_string(title), token_string(body, tags.get(pid, ''))))
load('community_search', rows)
print(sql("SELECT 'news', COUNT(*) FROM security_news_search UNION ALL SELECT 'community', COUNT(*) FROM community_search;"))
