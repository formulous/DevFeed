import argparse
import datetime as dt
import math
import random
import re
import sys
import unicodedata

CJK = re.compile(r'[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ㐀-䶿一-鿿豈-﫿]')
SEPARATOR = re.compile(r'[\W_]+', re.UNICODE)


def tokenize(text):
    if not text:
        return []
    tokens = []
    for word in SEPARATOR.split(unicodedata.normalize('NFKC', text).lower()):
        if not word:
            continue
        if CJK.search(word):
            tokens.extend(word[i:i + 2] for i in range(len(word) - 1))
        elif len(word) >= 2:
            tokens.append(word)
    return tokens


def token_string(*texts):
    return ' '.join(t for text in texts for t in tokenize(text))


def q(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace('\\', '\\\\').replace("'", "''").replace('\n', '\\n') + "'"


def read_tsv(path, cols):
    rows = []
    with open(path, encoding='utf-8') as f:
        next(f)
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) >= cols:
                rows.append([None if p == 'NULL' else p for p in parts[:cols]])
    return rows


def clip(text, limit):
    if len(text) <= limit:
        return text
    return text[:limit - 1].rstrip() + '…'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', required=True)
    ap.add_argument('--tags', required=True)
    ap.add_argument('--sources', required=True)
    ap.add_argument('--count', type=int, default=100000)
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--years', type=int, default=3)
    ap.add_argument('--batch', type=int, default=500)
    a = ap.parse_args()
    rnd = random.Random(a.seed)

    corpus = [(t or '', s or '') for t, s in read_tsv(a.corpus, 2)]
    title_words = [w for t, _ in corpus for w in t.split() if w]
    summary_words = [w for _, s in corpus for w in s.split() if w]
    tags = [(int(i), n, terms or '') for i, n, terms in read_tsv(a.tags, 3)]
    tag_weights = [1 / (r + 1) ** 0.9 for r in range(len(tags))]
    sources = [(int(i), n, t) for i, n, t in read_tsv(a.sources, 3)]
    source_weights = [1 / (r + 1) ** 0.8 for r in range(len(sources))]

    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None, microsecond=0)
    span = a.years * 365 * 86400
    offsets = sorted(span * (1 - math.sqrt(rnd.random())) for _ in range(a.count))
    offsets.reverse()

    out = sys.stdout
    out.write('SET NAMES utf8mb4;\nSET unique_checks = 0;\nSET foreign_key_checks = 0;\n')
    posts, post_tags, search = [], [], []

    def flush():
        if posts:
            out.write('INSERT INTO posts (id, source_id, source_type, guid, url, title, summary, published_at, view_count, created_at) VALUES\n')
            out.write(',\n'.join(posts) + ';\n')
            out.write('INSERT INTO post_tags (post_id, tag_id, tag_rank, published_at) VALUES\n')
            out.write(',\n'.join(post_tags) + ';\n')
            out.write('INSERT INTO post_search (post_id, title_tokens, body_tokens, feed_categories) VALUES\n')
            out.write(',\n'.join(search) + ';\n')
        posts.clear(); post_tags.clear(); search.clear()

    for pid in range(1, a.count + 1):
        source_id, source_name, source_type = rnd.choices(sources, source_weights)[0]
        published = now - dt.timedelta(seconds=int(offsets[pid - 1]))
        base_title, base_summary = rnd.choice(corpus)
        words = base_title.split() or [rnd.choice(title_words)]
        words = [w if rnd.random() < 0.5 else rnd.choice(title_words) for w in words]
        n_tags = min(5, max(1, int(rnd.expovariate(1 / 1.6)) + 1))
        chosen = []
        while len(chosen) < n_tags:
            t = rnd.choices(tags, tag_weights)[0]
            if t not in chosen:
                chosen.append(t)
        if rnd.random() < 0.6:
            words.insert(rnd.randrange(len(words) + 1), chosen[0][1])
        title = clip(' '.join(words), 200)
        s_words = base_summary.split()
        rnd.shuffle(s_words)
        extra = [rnd.choice(summary_words) for _ in range(rnd.randint(0, 10))] if summary_words else []
        summary = clip(' '.join(s_words + extra), 300) or None
        age_days = (now - published).total_seconds() / 86400
        views = int(math.exp(rnd.gauss(3.0, 1.4)) * (1.5 if age_days < 30 else 1.0))
        ts = published.strftime('%Y-%m-%d %H:%M:%S')
        posts.append(f"({pid},{source_id},{q(source_type)},{q('perf-' + str(pid))},{q(f'https://perf.example/{source_id}/{pid}')},{q(title)},{q(summary)},{q(ts)},{views},{q(ts)})")
        for rank, (tid, _, _) in enumerate(chosen, 1):
            post_tags.append(f'({pid},{tid},{rank},{q(ts)})')
        terms = ' '.join(f'{n} {terms}' for _, n, terms in chosen)
        categories = '\n'.join(n for _, n, _ in chosen[:2])
        search.append(f'({pid},{q(token_string(title))},{q(token_string(summary, terms, source_name))},{q(categories)})')
        if pid % a.batch == 0:
            flush()
    flush()
    out.write('SET unique_checks = 1;\nSET foreign_key_checks = 1;\n')


if __name__ == '__main__':
    main()
