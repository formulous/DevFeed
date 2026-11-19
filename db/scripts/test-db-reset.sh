#!/usr/bin/env bash
set -euo pipefail

: "${DB_USER:?DB_USER required}"
: "${MYSQL_PWD:?MYSQL_PWD required}"
TEST_DB="${TEST_DB:-devfeed_test}"
CONTAINER="${CONTAINER:-mariadb}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$TEST_DB" in
  *_test) ;;
  *) echo "refuse: TEST_DB must end with _test ($TEST_DB)" >&2; exit 1 ;;
esac

sql() { docker exec -i -e MYSQL_PWD="$MYSQL_PWD" "$CONTAINER" mariadb -u"$DB_USER" "$@"; }

echo "[test-db] recreate $TEST_DB"
sql -e "DROP DATABASE IF EXISTS \`$TEST_DB\`; CREATE DATABASE \`$TEST_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
DB_NAME="$TEST_DB" "$ROOT/scripts/migrate.sh" up "$ROOT"/migrations/*.sql
sql -N "$TEST_DB" -e "SELECT CONCAT('[test-db] tables=', COUNT(*)) FROM information_schema.tables WHERE table_schema = '$TEST_DB'"
