#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: $0 <up|down> <migration-file>..." >&2
  echo "env: DB_NAME (default devfeed), DB_USER, MYSQL_PWD, CONTAINER (default mariadb)" >&2
  exit 1
}

[ $# -ge 2 ] || usage
direction="$1"; shift
case "$direction" in up|down) ;; *) usage ;; esac

: "${DB_USER:?DB_USER required}"
: "${MYSQL_PWD:?MYSQL_PWD required}"
DB_NAME="${DB_NAME:-devfeed}"
CONTAINER="${CONTAINER:-mariadb}"

section() {
  awk -v want="-- migrate:$1" '
    /^-- migrate:/ { on = ($0 == want); next }
    on { print }
  ' "$2"
}

files=("$@")
if [ "$direction" = down ]; then
  reversed=()
  for ((i=${#files[@]}-1; i>=0; i--)); do reversed+=("${files[i]}"); done
  files=("${reversed[@]}")
fi

for f in "${files[@]}"; do
  echo "[$direction] $(basename "$f")"
  section "$direction" "$f" | docker exec -i -e MYSQL_PWD="$MYSQL_PWD" "$CONTAINER" \
    mariadb -u"$DB_USER" "$DB_NAME"
done
