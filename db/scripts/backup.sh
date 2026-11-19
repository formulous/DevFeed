#!/usr/bin/env bash
set -euo pipefail

: "${DB_USER:?DB_USER required}"
: "${MYSQL_PWD:?MYSQL_PWD required}"
DB_NAME="${DB_NAME:-devfeed}"
CONTAINER="${CONTAINER:-mariadb}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/devfeed}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/${DB_NAME}_${stamp}.sql.gz"
tmp="$target.partial"

docker exec -e MYSQL_PWD="$MYSQL_PWD" "$CONTAINER" mariadb-dump -u"$DB_USER" \
  --single-transaction --quick --hex-blob --routines --triggers --events \
  --default-character-set=utf8mb4 --databases "$DB_NAME" | gzip -9 > "$tmp"
gzip -t "$tmp"
mv "$tmp" "$target"
chmod 600 "$target"
echo "[backup] $target ($(du -h "$target" | cut -f1))"

find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/[backup] pruned /'
