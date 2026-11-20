import json, re, subprocess, sys, unicodedata

DB = sys.argv[2] if len(sys.argv) > 2 else 'devfeed'
RENAMES = json.load(open(sys.argv[1], encoding='utf-8'))
MAX_TAGS = 5


def run(sql):
    out = subprocess.run(['docker', 'exec', '-i', '-e', 'MYSQL_PWD', 'mariadb', 'mariadb', '-uroot', '-N', '-B', DB],
                         input=sql, capture_output=True, text=True)
    if out.returncode:
        print(out.stderr[:2000]); sys.exit(1)
    return [line.split('\t') for line in out.stdout.split('\n') if line]


def norm(s):
    return unicodedata.normalize('NFKC', s).lower()


def is_word(ch):
    return bool(ch) and (ch.isalnum() or unicodedata.category(ch)[0] in 'LN')


class Dictionary:
    def __init__(self, tags):
        seen, self.terms = set(), []
        for tid, name, syns in tags:
            for raw in [name, *syns]:
                t = norm(raw).strip()
                if not t or (tid, t) in seen: continue
                seen.add((tid, t)); self.terms.append((tid, t, all(ord(c) < 128 for c in t)))
        self.terms.sort(key=lambda x: -len(x[1]))

    def first(self, text, term, ascii_):
        frm = 0
        while frm <= len(text):
            i = text.find(term, frm)
            if i < 0: return -1
            if not ascii_: return i
            before = text[i - 1] if i > 0 else ''
            after = text[i + len(term)] if i + len(term) < len(text) else ''
            ok_b = not is_word(term[0]) or not before or not re.match(r'[a-z0-9]', before)
            ok_a = not is_word(term[-1]) or not after or not re.match(r'[a-z0-9]', after)
            if ok_b and ok_a: return i
            frm = i + 1
        return -1

    def match(self, text):
        found = {}
        if not text: return found
        n = norm(text)
        for tid, term, a in self.terms:
            p = self.first(n, term, a)
            if p < 0: continue
            if tid not in found or p < found[tid]: found[tid] = p
        return found

    def extract(self, title, summary, cats):
        ordered = []
        def push(m):
            for tid, _ in sorted(m.items(), key=lambda kv: (kv[1], kv[0])):
                if tid not in ordered: ordered.append(tid)
        push(self.match(title))
        cm = {}
        for idx, c in enumerate(cats):
            for tid in self.match(c):
                cm.setdefault(tid, idx)
        push(cm)
        push(self.match(summary))
        return ordered[:MAX_TAGS]


rows = run("SELECT t.id, t.name, IFNULL(s.synonym, '') FROM tags t LEFT JOIN tag_synonyms s ON s.tag_id = t.id ORDER BY t.id;")
tags = {}
for tid, name, syn in rows:
    tags.setdefault(int(tid), [name, []])
    if syn: tags[int(tid)][1].append(syn)
before = [(tid, n, s) for tid, (n, s) in tags.items()]

by_name = {norm(n): tid for tid, (n, _) in tags.items()}
all_syn = {norm(s): tid for tid, (_, ss) in tags.items() for s in ss}
after, plan, problems = [], [], []
for tid, (name, syns) in tags.items():
    new = RENAMES.get(name)
    if not new:
        after.append((tid, name, syns)); continue
    k = norm(new)
    if k in by_name and by_name[k] != tid: problems.append(f"{name} -> {new}: 다른 태그 이름과 충돌")
    if k in all_syn and all_syn[k] != tid: problems.append(f"{name} -> {new}: 다른 태그({all_syn[k]}) 동의어와 충돌")
    removed = [s for s in syns if norm(s) == k]
    kept = [s for s in syns if norm(s) != k]
    added = [] if any(norm(s) == norm(name) for s in kept) else [name]
    after.append((tid, new, kept + added))
    plan.append((tid, name, new, 'Y' if removed else 'N'))
for unknown in set(RENAMES) - {n for n, _ in tags.values()}:
    problems.append(f"{unknown}: 없는 태그")

posts = run("SELECT p.id, REPLACE(REPLACE(p.title, '\\t', ' '), '\\n', ' '), REPLACE(REPLACE(IFNULL(p.summary, ''), '\\t', ' '), '\\n', ' '), "
            "REPLACE(REPLACE(IFNULL(ps.feed_categories, ''), '\\t', ' '), '\\n', '\\\\n') FROM posts p LEFT JOIN post_search ps ON ps.post_id = p.id;")
d0, d1 = Dictionary(before), Dictionary(after)
changed = []
for pid, title, summary, cats in posts:
    c = [x for x in cats.split('\\n') if x]
    a, b = d0.extract(title, summary, c), d1.extract(title, summary, c)
    if a != b: changed.append((pid, title[:60], a, b))

print(f"rename {len(plan)}건, 이름=기존 동의어 {sum(p[3] == 'Y' for p in plan)}건, 새 매칭어 {sum(p[3] == 'N' for p in plan)}건")
for tid, old, new, hit in plan:
    if hit == 'N': print(f"  새 매칭어: {old} -> {new}")
print(f"충돌 {len(problems)}건"); [print('  ' + p) for p in problems]
print(f"글 {len(posts)}건 중 태깅 결과 변화 {len(changed)}건")
names = {tid: n for tid, n, _ in after}
for pid, title, a, b in changed[:40]:
    print(f"  {pid} {title} | {[names[x] for x in a]} -> {[names[x] for x in b]}")
