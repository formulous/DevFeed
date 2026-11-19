#!/usr/bin/env bash
set -euo pipefail

: "${DB_USER:?DB_USER required}"
: "${MYSQL_PWD:?MYSQL_PWD required}"
DB_NAME="${DB_NAME:-devfeed}"
CONTAINER="${CONTAINER:-mariadb}"
SEED_DIR="$(cd "$(dirname "$0")/../seeds" && pwd)"

for f in "$SEED_DIR"/*.sql; do
  echo "[seed] $(basename "$f")"
  docker exec -i -e MYSQL_PWD="$MYSQL_PWD" "$CONTAINER" mariadb -u"$DB_USER" "$DB_NAME" < "$f"
done
