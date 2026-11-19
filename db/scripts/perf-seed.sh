#!/usr/bin/env bash
set -euo pipefail

: "${DB_USER:?DB_USER required}"
: "${MYSQL_PWD:?MYSQL_PWD required}"
PERF_DB="${PERF_DB:-devfeed_perf}"
CORPUS_DB="${CORPUS_DB:-devfeed}"
CONTAINER="${CONTAINER:-mariadb}"
COUNT="${COUNT:-100000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

sql() { docker exec -i -e MYSQL_PWD="$MYSQL_PWD" "$CONTAINER" mariadb -u"$DB_USER" "$@"; }

existing="$(sql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$PERF_DB'")"
if [ "$existing" != "0" ]; then
  echo "$PERF_DB already has tables. drop it first." >&2
  exit 1
fi

echo "[perf] schema"
DB_NAME="$PERF_DB" "$ROOT/scripts/migrate.sh" up "$ROOT"/migrations/*.sql
DB_NAME="$PERF_DB" "$ROOT/scripts/seed.sh"

echo "[perf] export corpus from $CORPUS_DB"
sql -B "$CORPUS_DB" -e "SELECT title, summary FROM posts" > "$WORK/corpus.tsv"
sql -B "$PERF_DB" -e "SELECT t.id, t.name, COALESCE(GROUP_CONCAT(s.synonym SEPARATOR ' '), '') FROM tags t LEFT JOIN tag_synonyms s ON s.tag_id = t.id GROUP BY t.id ORDER BY RAND(1)" > "$WORK/tags.tsv"
sql -B "$PERF_DB" -e "SELECT id, name, source_type FROM sources ORDER BY RAND(2)" > "$WORK/sources.tsv"

echo "[perf] posts x $COUNT"
python3 -I "$ROOT/perf/generate_posts.py" --corpus "$WORK/corpus.tsv" --tags "$WORK/tags.tsv" --sources "$WORK/sources.tsv" --count "$COUNT" \
  | sql "$PERF_DB"

echo "[perf] users and relations"
sql "$PERF_DB" < "$ROOT/perf/relations.sql"

echo "[perf] analyze"
sql "$PERF_DB" -e "ANALYZE TABLE posts, post_tags, post_search, users, user_interest_tags, bookmarks, read_histories" > /dev/null
sql -t "$PERF_DB" -e "SELECT table_name, table_rows, ROUND((data_length + index_length) / 1048576) AS mb FROM information_schema.tables WHERE table_schema = '$PERF_DB' ORDER BY data_length + index_length DESC"
