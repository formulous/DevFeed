import datetime as dt
import math
import os
import random
import subprocess
import sys
from collections import Counter, defaultdict

DB = os.environ.get('DB_NAME', 'devfeed')
APPLY = os.environ.get('APPLY') == '1'
SEED = range(22, 42)
NIGHT_OWL = 36
KST = dt.timedelta(hours=9)
MIN = dt.timedelta(minutes=1)
rng = random.Random(46)


def sql(text):
    r = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', DB],
                       input=text, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[:3000])
    return [l.split('\t') for l in r.stdout.split('\n') if l]


def t(s):
    return dt.datetime.fromisoformat(s)


now_utc = t(sql('SELECT UTC_TIMESTAMP(3);')[0][0])
START = dt.datetime(2026, 10, 26, 8, 0)
END = now_utc + KST - dt.timedelta(hours=1)

sleep = {}
for u in SEED:
    bed = 30 + (u * 37) % 91
    wake = 7 * 60 + (u * 53) % 91
    sleep[u] = (180, 600) if u == NIGHT_OWL else (bed, wake)


def asleep(u, k):
    if u not in sleep:
        return False
    m = k.hour * 60 + k.minute
    b, w = sleep[u]
    return b <= m < w


def wake_after(u, k):
    if not asleep(u, k):
        return k
    b, w = sleep[u]
    return k.replace(hour=w // 60, minute=w % 60, second=0, microsecond=0) + dt.timedelta(minutes=rng.randint(0, 40), seconds=rng.randint(0, 59))


posts = {int(r[0]): {'author': int(r[1]), 'old': t(r[2]) + KST, 'score': int(r[3]), 'seed': 22 <= int(r[1]) <= 41}
         for r in sql("SELECT cp.post_id, cp.user_id, p.published_at, p.like_count + p.comment_count FROM community_posts cp JOIN posts p ON p.id = cp.post_id WHERE cp.status <> 'DELETED';")}
blog_pub = {}
comments = []
for r in sql("""SELECT c.id, c.post_id, IFNULL(c.parent_id, 0), IFNULL(c.user_id, 0), c.created_at, p.kind, p.published_at
                FROM comments c JOIN posts p ON p.id = c.post_id
                WHERE p.kind = 'COMMUNITY' OR c.user_id BETWEEN 22 AND 41 ORDER BY c.post_id, c.created_at, c.id;"""):
    cid, pid, par, uid = map(int, r[:4])
    comments.append({'id': cid, 'post': pid, 'parent': par, 'user': uid, 'old': t(r[4]) + KST, 'seed': 22 <= uid <= 41})
    if r[5] != 'COMMUNITY':
        blog_pub[pid] = t(r[6]) + KST
likes = [{'user': int(r[0]), 'post': int(r[1]), 'old': t(r[2]) + KST, 'seed': 22 <= int(r[0]) <= 41}
         for r in sql("""SELECT l.user_id, l.post_id, l.created_at FROM post_likes l JOIN posts p ON p.id = l.post_id
                         LEFT JOIN community_posts cp ON cp.post_id = p.id
                         WHERE l.user_id BETWEEN 22 AND 41 OR cp.user_id BETWEEN 22 AND 41;""")]

deadline = defaultdict(lambda: END - dt.timedelta(hours=2))
for c in comments:
    if not c['seed'] and c['post'] in posts:
        deadline[c['post']] = min(deadline[c['post']], c['old'] - dt.timedelta(minutes=30))
for l in likes:
    if not l['seed'] and l['post'] in posts:
        deadline[l['post']] = min(deadline[l['post']], l['old'] - dt.timedelta(minutes=30))

HOUR_W = {0: 0.6, 1: 0.2, 7: 0.3, 8: 0.6, 9: 1.0, 10: 1.0, 11: 1.0, 12: 2.2, 13: 1.8, 14: 0.4, 15: 0.4, 16: 0.4, 17: 0.5,
          18: 0.8, 19: 1.0, 20: 2.0, 21: 2.2, 22: 2.2, 23: 1.8}
hours = list(HOUR_W)
weights = [HOUR_W[h] for h in hours]

days = []
d = START.date()
while d <= END.date():
    days.append(d)
    d += dt.timedelta(days=1)
seed_posts = [p for p, v in posts.items() if v['seed']]
dw = [(0.4 if d == END.date() else (0.75 if d.weekday() >= 5 else 1.0)) for d in days]
raw = [len(seed_posts) * w / sum(dw) for w in dw]
counts = [max(2, min(8, int(x))) for x in raw]
order = sorted(range(len(days)), key=lambda i: raw[i] - int(raw[i]), reverse=True)
i = 0
while sum(counts) < len(seed_posts):
    j = order[i % len(order)]
    if counts[j] < 7:
        counts[j] += 1
    i += 1
while sum(counts) > len(seed_posts):
    j = max(range(len(days)), key=lambda k: counts[k])
    counts[j] -= 1

top = sorted(seed_posts, key=lambda p: (-posts[p]['score'], p))[:10]
recent_pick = set(top[:5])
recent_days = [i for i, d in enumerate(days) if d >= (END - dt.timedelta(days=6)).date() and d < END.date()]
slots = [i for i, c in enumerate(counts) for _ in range(c)]
rng.shuffle(slots)
assign = {}
for p in sorted(recent_pick):
    k = next(k for k, s in enumerate(slots) if s in recent_days)
    assign[p] = slots.pop(k)
rest = [p for p in seed_posts if p not in recent_pick]
rng.shuffle(rest)
for p, s in zip(rest, slots):
    assign[p] = s

new_post = {p: v['old'] for p, v in posts.items() if not v['seed']}
by_author = defaultdict(list)


def fits(p, k):
    a = posts[p]['author']
    if asleep(a, k) or k < START or k > deadline[p]:
        return False
    same = [x for x in by_author[a]]
    if any(abs((k - x).total_seconds()) < 3 * 3600 for x in same):
        return False
    return sum(1 for x in same if x.date() == k.date()) < 3


def place(p, day):
    for _ in range(300):
        h = rng.choices(hours, weights)[0]
        k = dt.datetime.combine(day, dt.time(h, rng.randint(0, 59), rng.randint(0, 59), rng.randint(0, 999) * 1000))
        if fits(p, k):
            return k
    return None


failed = []
for p in sorted(assign, key=lambda p: (deadline[p], p)):
    k = place(p, days[assign[p]])
    if k is None:
        for i in sorted(range(len(days)), key=lambda i: abs(i - assign[p])):
            if sum(1 for x in new_post.values() if x.date() == days[i]) >= 8:
                continue
            k = place(p, days[i])
            if k:
                break
    if k is None:
        failed.append(p)
        continue
    new_post[p] = k
    by_author[posts[p]['author']].append(k)
if failed:
    sys.exit(f'post placement failed: {failed}')


def delay(limit_h):
    x = math.exp(rng.gauss(math.log(70), 1.15))
    return dt.timedelta(minutes=min(max(5, x), limit_h * 60))


new_comment = {}
by_post = defaultdict(list)
for c in comments:
    by_post[c['post']].append(c)
for pid, cs in by_post.items():
    if pid in new_post:
        base = new_post[pid]
    else:
        pub = blog_pub[pid]
        base = pub if pub >= START else START + dt.timedelta(days=rng.randint(0, 20), hours=rng.randint(4, 14))
    room_h = max(0.2, min(48, (END - base).total_seconds() / 3600 - 0.2))
    tops = sorted(delay(room_h) for c in cs if c['seed'] and not c['parent'])
    prev = base
    for c in cs:
        if not c['seed']:
            new_comment[c['id']] = c['old']
            prev = max(prev, c['old'])
            continue
        if c['parent']:
            pt = new_comment[c['parent']]
            lo = max(prev, pt) + dt.timedelta(minutes=rng.randint(5, 25))
            k = max(lo, pt + dt.timedelta(minutes=min(max(5, math.exp(rng.gauss(math.log(40), 1.0))), 12 * 60)))
        else:
            k = max(prev + dt.timedelta(minutes=rng.randint(2, 9)), base + tops.pop(0))
        k = wake_after(c['user'], k.replace(microsecond=rng.randint(0, 999) * 1000))
        if k > END:
            k = max(prev + dt.timedelta(seconds=rng.randint(70, 180)), END - dt.timedelta(minutes=rng.randint(5, 30)))
        new_comment[c['id']] = k
        prev = k
    nxt = [c for c in cs if not c['seed']]
    for f in nxt:
        before = [c for c in cs if c['seed'] and (c['old'], c['id']) < (f['old'], f['id'])]
        if before and new_comment[before[-1]['id']] >= f['old']:
            span = (f['old'] - base).total_seconds()
            for j, c in enumerate(before):
                new_comment[c['id']] = base + dt.timedelta(seconds=span * (j + 1) / (len(before) + 1))

new_like = {}
for l in likes:
    if not l['seed']:
        continue
    pid = l['post']
    base = new_post.get(pid) or max(blog_pub.get(pid, START), START)
    if pid not in new_post and pid not in blog_pub:
        base = max(t(sql(f"SELECT published_at FROM posts WHERE id = {pid};")[0][0]) + KST, START)
    room = max(15, (END - base).total_seconds() / 60 - 10)
    k = base + dt.timedelta(minutes=min(max(10, math.exp(rng.gauss(math.log(300), 1.3))), room))
    k = wake_after(l['user'], k.replace(microsecond=rng.randint(0, 999) * 1000))
    if k > END:
        k = END - dt.timedelta(minutes=rng.randint(5, 60))
        if asleep(l['user'], k):
            k = base + dt.timedelta(minutes=15)
    new_like[(l['user'], pid)] = k

acts = defaultdict(list)
for p, k in new_post.items():
    if posts[p]['seed']:
        acts[posts[p]['author']].append(('p', p, k))
for c in comments:
    if c['seed']:
        acts[c['user']].append(('c', c['id'], new_comment[c['id']]))
for (u, p), k in new_like.items():
    acts[u].append(('l', (u, p), k))
for u, a in acts.items():
    a.sort(key=lambda x: x[2])
    for j in range(1, len(a)):
        if (a[j][2] - a[j - 1][2]) < dt.timedelta(minutes=2) and a[j][0] == 'l':
            k = a[j - 1][2] + dt.timedelta(minutes=2, seconds=rng.randint(1, 50))
            if k <= END and not asleep(u, k):
                new_like[a[j][1]] = k
                a[j] = (a[j][0], a[j][1], k)

utc = lambda k: (k - KST).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
out = [f"SET @dry = {'FALSE' if APPLY else 'TRUE'};",
       'CREATE TEMPORARY TABLE np (id BIGINT UNSIGNED PRIMARY KEY, t DATETIME(3) NOT NULL);',
       'CREATE TEMPORARY TABLE nc (id BIGINT UNSIGNED PRIMARY KEY, t DATETIME(3) NOT NULL);',
       'CREATE TEMPORARY TABLE nl (user_id BIGINT UNSIGNED NOT NULL, post_id BIGINT UNSIGNED NOT NULL, t DATETIME(3) NOT NULL, PRIMARY KEY (user_id, post_id));',
       'CREATE TEMPORARY TABLE sl (user_id BIGINT UNSIGNED PRIMARY KEY, bed INT NOT NULL, wake INT NOT NULL);']
out.append('INSERT INTO np VALUES ' + ','.join(f"({p},'{utc(k)}')" for p, k in new_post.items() if posts[p]['seed']) + ';')
out.append('INSERT INTO nc VALUES ' + ','.join(f"({c['id']},'{utc(new_comment[c['id']])}')" for c in comments if c['seed']) + ';')
out.append('INSERT INTO nl VALUES ' + ','.join(f"({u},{p},'{utc(k)}')" for (u, p), k in new_like.items()) + ';')
out.append('INSERT INTO sl VALUES ' + ','.join(f"({u},{b},{w})" for u, (b, w) in sleep.items()) + ';')
end_utc = utc(END)
seed = 'BETWEEN 22 AND 41'
kmin = lambda col: f"(HOUR({col} + INTERVAL 9 HOUR) * 60 + MINUTE({col} + INTERVAL 9 HOUR))"
out.append(f"""DELIMITER //
BEGIN NOT ATOMIC
main: BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  SET @fail = NULL;
  SET @before = (SELECT CONCAT_WS('/', (SELECT COUNT(*) FROM community_posts WHERE status = 'VISIBLE'), (SELECT COUNT(*) FROM comments),
    (SELECT COUNT(*) FROM post_likes), (SELECT COUNT(*) FROM posts), (SELECT SUM(score) FROM users)));
  START TRANSACTION;
  UPDATE posts p JOIN np ON np.id = p.id SET p.published_at = np.t, p.created_at = np.t, p.updated_at = p.updated_at;
  UPDATE community_posts cp JOIN np ON np.id = cp.post_id SET cp.published_at = np.t, cp.created_at = np.t, cp.updated_at = cp.updated_at;
  UPDATE post_tags pt JOIN np ON np.id = pt.post_id SET pt.published_at = np.t;
  UPDATE comments c JOIN nc ON nc.id = c.id SET c.created_at = nc.t, c.updated_at = c.updated_at;
  UPDATE post_likes l JOIN nl ON nl.user_id = l.user_id AND nl.post_id = l.post_id SET l.created_at = nl.t;

  DELETE FROM score_events WHERE user_id {seed} AND kind IN ('LIKE', 'COMMENT', 'POST_WRITE');
  DELETE FROM score_events WHERE kind = 'LIKE_RECEIVED';
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at)
    SELECT user_id, 'LIKE', post_id, 0, 2, created_at FROM post_likes WHERE user_id {seed};
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at, revoked_at)
    SELECT user_id, 'COMMENT', id, 0, IF(rn <= 10, 5, 0), created_at, IF(status = 'HIDDEN', hidden_at, NULL) FROM (
      SELECT c.id, c.user_id, c.status, c.hidden_at, c.created_at,
        ROW_NUMBER() OVER (PARTITION BY c.user_id, DATE(c.created_at + INTERVAL 9 HOUR) ORDER BY c.created_at, c.id) rn
      FROM comments c WHERE c.user_id {seed} AND c.status IN ('VISIBLE', 'HIDDEN')) x;
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at, revoked_at)
    SELECT user_id, 'POST_WRITE', post_id, 0, IF(rn <= 3, 10, 0), created_at, IF(status = 'HIDDEN', hidden_at, NULL) FROM (
      SELECT cp.post_id, cp.user_id, cp.status, cp.hidden_at, cp.created_at,
        ROW_NUMBER() OVER (PARTITION BY cp.user_id, DATE(cp.created_at + INTERVAL 9 HOUR) ORDER BY cp.created_at, cp.post_id) rn
      FROM community_posts cp WHERE cp.user_id {seed} AND cp.status <> 'DELETED') x;
  INSERT INTO score_events (user_id, kind, ref_id, actor_id, points, created_at)
    SELECT author, 'LIKE_RECEIVED', post_id, liker, 1, created_at FROM (
      SELECT cp.user_id author, l.post_id, l.user_id liker, l.created_at,
        ROW_NUMBER() OVER (PARTITION BY cp.user_id, DATE(l.created_at + INTERVAL 9 HOUR) ORDER BY l.created_at, l.post_id, l.user_id) rn
      FROM post_likes l JOIN community_posts cp ON cp.post_id = l.post_id
      WHERE cp.user_id IS NOT NULL AND cp.status <> 'DELETED' AND cp.user_id <> l.user_id) x WHERE rn <= 50;
  UPDATE users u LEFT JOIN (SELECT user_id, SUM(points) s FROM score_events WHERE revoked_at IS NULL GROUP BY user_id) e ON e.user_id = u.id
    SET u.score = IFNULL(e.s, 0), u.updated_at = u.updated_at WHERE u.score <> IFNULL(e.s, 0);

  SET @after = (SELECT CONCAT_WS('/', (SELECT COUNT(*) FROM community_posts WHERE status = 'VISIBLE'), (SELECT COUNT(*) FROM comments),
    (SELECT COUNT(*) FROM post_likes), (SELECT COUNT(*) FROM posts)));
  IF SUBSTRING_INDEX(@before, '/', 4) <> @after THEN SET @fail = 'counts changed'; LEAVE main; END IF;
  SET @sleep_v = (SELECT COUNT(*) FROM community_posts cp JOIN sl ON sl.user_id = cp.user_id WHERE {kmin('cp.published_at')} >= sl.bed AND {kmin('cp.published_at')} < sl.wake)
    + (SELECT COUNT(*) FROM comments c JOIN sl ON sl.user_id = c.user_id WHERE {kmin('c.created_at')} >= sl.bed AND {kmin('c.created_at')} < sl.wake)
    + (SELECT COUNT(*) FROM post_likes l JOIN sl ON sl.user_id = l.user_id WHERE {kmin('l.created_at')} >= sl.bed AND {kmin('l.created_at')} < sl.wake);
  SET @future = (SELECT COUNT(*) FROM nc WHERE t > '{end_utc}') + (SELECT COUNT(*) FROM nl WHERE t > '{end_utc}') + (SELECT COUNT(*) FROM np WHERE t > '{end_utc}');
  SET @early_c = (SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.created_at < p.published_at);
  SET @early_r = (SELECT COUNT(*) FROM comments c JOIN comments par ON par.id = c.parent_id WHERE c.created_at < par.created_at);
  SET @early_l = (SELECT COUNT(*) FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE l.created_at < p.published_at);
  SET @early_u = (SELECT COUNT(*) FROM users u WHERE u.id {seed} AND u.created_at > LEAST(
      IFNULL((SELECT MIN(created_at) FROM comments WHERE user_id = u.id), '9999-01-01'),
      IFNULL((SELECT MIN(created_at) FROM community_posts WHERE user_id = u.id), '9999-01-01'),
      IFNULL((SELECT MIN(created_at) FROM post_likes WHERE user_id = u.id), '9999-01-01')));
  SET @days = (SELECT CONCAT(MIN(n), '-', MAX(n)) FROM (SELECT DATE(published_at + INTERVAL 9 HOUR) d, COUNT(*) n FROM community_posts WHERE user_id {seed} GROUP BY 1) x);
  SET @per_author_day = (SELECT MAX(n) FROM (SELECT user_id, DATE(published_at + INTERVAL 9 HOUR) d, COUNT(*) n FROM community_posts WHERE user_id {seed} GROUP BY 1, 2) x);
  IF @sleep_v + @future + @early_c + @early_r + @early_l + @early_u > 0 OR @per_author_day > 3 THEN SET @fail = 'rule check failed'; LEAVE main; END IF;
  IF @dry THEN ROLLBACK; ELSE COMMIT; END IF;
END main;
IF @fail IS NOT NULL THEN ROLLBACK; END IF;
SELECT IF(@fail IS NULL, IF(@dry, 'DRY RUN (rolled back)', 'COMMITTED'), CONCAT('ROLLED BACK: ', @fail)) result, @before, @after,
  @sleep_v sleep_v, @future future, @early_c early_comment, @early_r early_reply, @early_l early_like, @early_u early_user, @days posts_per_day, @per_author_day max_author_day;
END //
DELIMITER ;""")
print(f"END(KST) {END}  days {len(days)}  counts {counts}  top10 {top}  recent5 {sorted(recent_pick)}", file=sys.stderr)
print(sql('\n'.join(out)), file=sys.stderr)
