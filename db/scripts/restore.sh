#!/usr/bin/env bash
set -euo pipefail

usage() { echo "usage: $0 <backup.sql.gz> <target_db> [--force]" >&2; exit 1; }
[ $# -ge 2 ] || usage
file="$1"; target="$2"; force="${3:-}"

: "${DB_USER:?DB_USER required}"
: "${MYSQL_PWD:?MYSQL_PWD required}"
CONTAINER="${CONTAINER:-mariadb}"
SOURCE_DB="${SOURCE_DB:-devfeed}"

[ -f "$file" ] || { echo "no such file: $file" >&2; exit 1; }
if [ "$target" = "$SOURCE_DB" ] && [ "$force" != "--force" ]; then
  echo "refuse: restoring into $SOURCE_DB overwrites live data. add --force" >&2
  exit 1
fi

sql() { docker exec -i -e MYSQL_PWD="$MYSQL_PWD" "$CONTAINER" mariadb -u"$DB_USER" "$@"; }

sql -e "CREATE DATABASE IF NOT EXISTS \`$target\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip -c "$file" \
  | sed -E "s/^CREATE DATABASE \/\*!32312 IF NOT EXISTS\*\/ \`$SOURCE_DB\`.*$//; s/^USE \`$SOURCE_DB\`;$//" \
  | sql "$target"
sql -N -e "SELECT CONCAT('[restore] ', '$target', ' tables=', COUNT(*)) FROM information_schema.tables WHERE table_schema = '$target'"
