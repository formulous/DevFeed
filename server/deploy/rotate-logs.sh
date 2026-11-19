#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${LOG_DIR:-$(cd "$(dirname "$0")/.." && pwd)/logs}"
KEEP="${KEEP:-7}"
MAX_BYTES="${MAX_BYTES:-10485760}"
MAX_AGE_SEC="${MAX_AGE_SEC:-86400}"
FORCE="${FORCE:-0}"
NOW="$(date +%s)"

rotate() {
  local log="$1"
  [ -s "$log" ] || return 0
  local size last=0
  size="$(stat -f %z "$log")"
  [ -f "$log.1.gz" ] && last="$(stat -f %m "$log.1.gz")"
  if [ "$FORCE" != 1 ] && [ "$size" -lt "$MAX_BYTES" ] && [ $((NOW - last)) -lt "$MAX_AGE_SEC" ]; then
    return 0
  fi
  rm -f "$log.$KEEP.gz"
  for ((i = KEEP - 1; i >= 1; i--)); do
    [ -f "$log.$i.gz" ] && mv "$log.$i.gz" "$log.$((i + 1)).gz"
  done
  cp -p "$log" "$log.1"
  : > "$log"
  gzip -f "$log.1"
  echo "$(date '+%Y-%m-%dT%H:%M:%S%z') rotated $(basename "$log") (${size} bytes)"
}

[ -d "$LOG_DIR" ] || exit 0
for log in "$LOG_DIR"/server.log "$LOG_DIR"/server.err.log "$LOG_DIR"/logrotate.log; do
  rotate "$log"
done
