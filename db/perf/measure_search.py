import re
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_posts import tokenize

DB = os.environ.get('PERF_DB', 'devfeed_perf')
RUNS = int(os.environ.get('RUNS', '10'))
TERMS = os.environ.get('TERMS', 'redux|코드|인덱스|자바스크립트|쿠버네티스|알아보기|fetch|자바스크립트 메서드|react 상태 관리|존재하지않는검색어').split('|')


def boolean_query(text):
    return ' '.join('+' + t for t in dict.fromkeys(tokenize(text)))


def phrase_query(text):
    toks = list(dict.fromkeys(tokenize(text)))
    return '"' + ' '.join(toks) + '"'


def lit(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "''") + "'"


def queries(term):
    bq = lit(boolean_query(term))
    match_all = f"MATCH(s.title_tokens, s.body_tokens) AGAINST({bq} IN BOOLEAN MODE)"
    score = f"MATCH(s.title_tokens) AGAINST({bq} IN BOOLEAN MODE) * 2 + {match_all}"
    base = f"FROM post_search s JOIN posts p ON p.id = s.post_id WHERE {match_all}"
    like = lit('%' + term + '%')
    return [
        ('관련도 1페이지', f"SELECT s.post_id, {score} AS score {base} ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20"),
        ('관련도 50페이지', f"SELECT s.post_id, {score} AS score {base} ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20 OFFSET 980"),
        ('최신순 1페이지', f"SELECT s.post_id {base} ORDER BY p.published_at DESC, p.id DESC LIMIT 20"),
        ('total (상한 1000)', f"SELECT COUNT(*) FROM (SELECT 1 {base} LIMIT 1000) c"),
        ('total (전체)', f"SELECT COUNT(*) {base}"),
        ('관련도 + 1M', f"SELECT s.post_id, {score} AS score {base} AND p.published_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20"),
        ('관련도 + 태그 28', f"SELECT s.post_id, {score} AS score {base} AND EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = s.post_id AND pt.tag_id IN (28)) ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20"),
        ('관련도 + 소스 12,8', f"SELECT s.post_id, {score} AS score {base} AND p.source_id IN (12, 8) ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20"),
        ('권장 관련도 (조인 없음)', f"SELECT s.post_id, {score} AS score FROM post_search s WHERE {match_all} ORDER BY score DESC, s.post_id DESC LIMIT 20"),
        ('권장 관련도 + 1Y + 소스', f"SELECT s.post_id, {score} AS score FROM post_search s JOIN posts p FORCE INDEX (idx_posts_search_filter) ON p.id = s.post_id WHERE {match_all} AND p.published_at >= UTC_TIMESTAMP(3) - INTERVAL 365 DAY AND p.source_id IN (12, 8, 21, 5, 3) ORDER BY score DESC, p.published_at DESC, p.id DESC LIMIT 20"),
        ('권장 최신순', f"SELECT s.post_id FROM post_search s JOIN posts p FORCE INDEX (idx_posts_search_filter) ON p.id = s.post_id WHERE {match_all} ORDER BY p.published_at DESC, p.id DESC LIMIT 20"),
        ('권장 태그 28 필터', f"SELECT s.post_id, {score} AS score FROM post_search s JOIN post_tags pt ON pt.post_id = s.post_id AND pt.tag_id IN (28) WHERE {match_all} ORDER BY score DESC, s.post_id DESC LIMIT 20"),
        ('구문(phrase) 1페이지', f"SELECT s.post_id {base.replace(bq, lit(phrase_query(term)))} LIMIT 20"),
        ('기준선 LIKE 최신순', f"SELECT p.id FROM posts p WHERE p.title LIKE {like} OR p.summary LIKE {like} ORDER BY p.published_at DESC, p.id DESC LIMIT 20"),
        ('기준선 LIKE total', f"SELECT COUNT(*) FROM posts p WHERE p.title LIKE {like} OR p.summary LIKE {like}"),
    ]


def run(sql_list):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                         input='\n'.join(sql_list), capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr[:2000])
    pattern = r'(?ms)^\{\s*\n(?:\s*"query_optimization": \{\s*"r_total_time_ms": ([\d.]+)\s*\},)?\s*"query_block": \{.*?"r_total_time_ms": ([\d.]+)'
    times = [float(o or 0) + float(e) for o, e in re.findall(pattern, out.stdout)]
    if len(times) != len(sql_list):
        sys.exit(f'parsed {len(times)} of {len(sql_list)}')
    return times


def main():
    rows = []
    for term in TERMS:
        qs = queries(term)
        count_sql = f"SELECT COUNT(*) FROM post_search s WHERE MATCH(s.title_tokens, s.body_tokens) AGAINST({lit(boolean_query(term))} IN BOOLEAN MODE);"
        cnt = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', DB],
                             input=count_sql, capture_output=True, text=True).stdout.strip()
        docs = run([f"ANALYZE FORMAT=JSON {q};" for _, q in qs for _ in range(RUNS + 1)])
        for i, (name, _) in enumerate(qs):
            chunk = docs[i * (RUNS + 1):(i + 1) * (RUNS + 1)][1:]
            t = sorted(chunk)
            rows.append((term, cnt, name, t[len(t) // 2], t[min(len(t) - 1, int(len(t) * 0.95))]))
    print('| 검색어 | 매칭 수 | 쿼리 | p50 ms | p95 ms |\n|---|---|---|---|---|')
    for term, cnt, name, p50, p95 in rows:
        print(f'| {term} | {cnt} | {name} | {p50:.1f} | {p95:.1f} |')


if __name__ == '__main__':
    main()
