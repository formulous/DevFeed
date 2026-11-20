import json, re, subprocess, sys

DB = sys.argv[1] if len(sys.argv) > 1 else 'devfeed_perf'
RUNS = 20
A, I = "'2026-11-18 10:15:36.000'", 99800
OLD = "'2025-11-18 00:00:00.000'"
FIELDS = {
    'BACKEND': ('백엔드', '아키텍처'),
    'FRONTEND': ('프론트엔드', '디자인'),
    'AI': ('AI',),
    'DATA': ('데이터', '데이터베이스'),
    'INFRA': ('인프라', 'DevOps', '클라우드'),
    'MOBILE': ('모바일',),
    'SECURITY': ('보안',),
}


def run(sql):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', '-r', DB],
                         input=sql, capture_output=True, text=True)
    if out.returncode:
        print(out.stderr[:2000]); sys.exit(1)
    return out.stdout


tag_rows = run("SELECT category, id FROM tags WHERE category IS NOT NULL;").split('\n')
by_cat = {}
for line in filter(None, tag_rows):
    c, i = line.split('\t'); by_cat.setdefault(c, []).append(int(i))
ftags = {f: sorted(t for c in cats for t in by_cat.get(c, [])) for f, cats in FIELDS.items()}
news = {r: [int(x) for x in run(f"SELECT id FROM sources WHERE kind='SECURITY_NEWS' AND region='{r}' ORDER BY id;").split()] for r in ('DOMESTIC', 'OVERSEAS')}


def cur(a, i, at=A, cid=I):
    return f"({a} < {at} OR ({a} = {at} AND {i} < {cid}))"


def wrap(subs, op):
    return f"SELECT id, published_at FROM ({f' {op} '.join(subs)}) f ORDER BY published_at DESC, id DESC LIMIT 21"


def field_sub(t, at=A, join=''):
    j = ' JOIN posts p ON p.id = pt.post_id' if join else ''
    return (f"(SELECT pt.post_id AS id, pt.published_at AS published_at FROM post_tags pt{j} WHERE pt.tag_id = {t} AND pt.kind = 'BLOG'"
            f" AND {cur('pt.published_at', 'pt.post_id', at)}{join} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21)")


def field_feed(f, at=A, join=''):
    return wrap([field_sub(t, at, join) for t in ftags[f]], 'UNION')


def in_field(f, col):
    return f"EXISTS (SELECT 1 FROM post_tags fx WHERE fx.post_id = {col} AND fx.tag_id IN ({','.join(map(str, ftags[f]))}))"


def src_sub(s, extra=''):
    return (f"(SELECT p.id AS id, p.published_at AS published_at FROM posts p WHERE p.source_id = {s} AND {cur('p.published_at', 'p.id')}{extra}"
            f" ORDER BY p.published_at DESC, p.id DESC LIMIT 21)")


Q = [("최신 (BLOG) 다음 페이지", f"SELECT p.id, p.published_at FROM posts p WHERE p.kind = 'BLOG' AND {cur('p.published_at', 'p.id')} ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
     ("최신 (BLOG) 1년 전 커서", f"SELECT p.id, p.published_at FROM posts p WHERE p.kind = 'BLOG' AND {cur('p.published_at', 'p.id', OLD)} ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
     ("기업 탭", f"SELECT p.id, p.published_at FROM posts p WHERE p.kind = 'BLOG' AND p.source_type = 'COMPANY' AND {cur('p.published_at', 'p.id')} ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
     ("개인 탭", f"SELECT p.id, p.published_at FROM posts p WHERE p.kind = 'BLOG' AND p.source_type = 'PERSONAL' AND {cur('p.published_at', 'p.id')} ORDER BY p.published_at DESC, p.id DESC LIMIT 21")]
Q += [(f"분야 {f} ({len(ftags[f])}태그)", field_feed(f)) for f in FIELDS]
Q += [("분야 SECURITY 1년 전 커서", field_feed('SECURITY', OLD)),
      ("분야 BACKEND + 개인 탭", field_feed('BACKEND', A, " AND p.source_type = 'PERSONAL'")),
      ("분야 MOBILE + 개인 탭 (최악)", field_feed('MOBILE', A, " AND p.source_type = 'PERSONAL'")),
      ("분야 BACKEND + 태그 React (분야 밖, 최악)",
       f"SELECT pt.post_id, pt.published_at FROM post_tags pt WHERE pt.tag_id = 15 AND pt.kind = 'BLOG' AND {cur('pt.published_at', 'pt.post_id')} AND {in_field('BACKEND', 'pt.post_id')} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21"),
      ("분야 BACKEND + 태그 Kafka (분야 안)",
       f"SELECT pt.post_id, pt.published_at FROM post_tags pt WHERE pt.tag_id = 76 AND pt.kind = 'BLOG' AND {cur('pt.published_at', 'pt.post_id')} AND {in_field('BACKEND', 'pt.post_id')} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21"),
      ("분야 SECURITY + 개인 소스 2개", wrap([src_sub(s, ' AND ' + in_field('SECURITY', 'p.id')) for s in (34, 36)], 'UNION ALL')),
      ("인기 MONTH (BLOG)", "SELECT id FROM posts WHERE kind = 'BLOG' AND published_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY AND view_count > 0 ORDER BY view_count DESC, published_at DESC, id DESC LIMIT 20"),
      ("인기 YEAR (BLOG)", "SELECT id FROM posts WHERE kind = 'BLOG' AND published_at >= UTC_TIMESTAMP(3) - INTERVAL 365 DAY AND view_count > 0 ORDER BY view_count DESC, published_at DESC, id DESC LIMIT 20"),
      ("인기 MONTH + 분야 SECURITY", f"SELECT p.id FROM posts p WHERE p.kind = 'BLOG' AND p.published_at >= UTC_TIMESTAMP(3) - INTERVAL 30 DAY AND p.view_count > 0 AND {in_field('SECURITY', 'p.id')} ORDER BY p.view_count DESC, p.published_at DESC, p.id DESC LIMIT 20"),
      ("인기 YEAR + 분야 MOBILE", f"SELECT p.id FROM posts p WHERE p.kind = 'BLOG' AND p.published_at >= UTC_TIMESTAMP(3) - INTERVAL 365 DAY AND p.view_count > 0 AND {in_field('MOBILE', 'p.id')} ORDER BY p.view_count DESC, p.published_at DESC, p.id DESC LIMIT 20"),
      ("보안 뉴스 전체", f"SELECT p.id, p.published_at FROM posts p WHERE p.kind = 'SECURITY_NEWS' AND {cur('p.published_at', 'p.id')} ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
      ("보안 뉴스 국내 (출처 3곳 UNION ALL)", wrap([src_sub(s) for s in news['DOMESTIC']], 'UNION ALL')),
      ("보안 뉴스 출처 1곳", f"SELECT p.id, p.published_at FROM posts p WHERE p.source_id = {news['OVERSEAS'][0]} AND {cur('p.published_at', 'p.id')} ORDER BY p.published_at DESC, p.id DESC LIMIT 21"),
      ("태그 1개 보안 분류 (BLOG)", f"SELECT pt.post_id, pt.published_at FROM post_tags pt WHERE pt.tag_id = {ftags['SECURITY'][0]} AND pt.kind = 'BLOG' AND {cur('pt.published_at', 'pt.post_id')} ORDER BY pt.published_at DESC, pt.post_id DESC LIMIT 21"),
      ("태그 수 (BLOG)", "SELECT tag_id, COUNT(*) FROM post_tags WHERE kind = 'BLOG' GROUP BY tag_id"),
      ("추천 후보 14일 (태그 30개, BLOG)", f"SELECT pt.post_id, pt.tag_id, p.source_id, p.view_count, p.published_at FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE pt.tag_id IN ({','.join(str(t) for t in range(1, 31))}) AND pt.kind = 'BLOG' AND pt.published_at >= UTC_TIMESTAMP(3) - INTERVAL 14 DAY")]

if len(sys.argv) > 2 and sys.argv[2] == '--sql':
    for t, q in Q: print(f"-- {t}\n{q};\n")
    sys.exit(0)

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
