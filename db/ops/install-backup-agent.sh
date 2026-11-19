#!/usr/bin/env bash
set -euo pipefail

LABEL="org.devfeed.backup"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$HOME/.config/devfeed/backup.env"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
DOCKER_DIR="$(dirname "$(command -v docker)")"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE (DB_USER=..., MYSQL_PWD=..., chmod 600)" >&2
  exit 1
fi
if [ "$(stat -f '%Lp' "$ENV_FILE")" != "600" ]; then
  echo "refuse: $ENV_FILE must be chmod 600" >&2
  exit 1
fi

mkdir -p "$HOME/backups/devfeed" "$(dirname "$TARGET")"
sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" -e "s#__DOCKER_DIR__#$DOCKER_DIR#g" \
  "$REPO/db/ops/$LABEL.plist.template" > "$TARGET"
plutil -lint "$TARGET"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$TARGET"
launchctl print "gui/$(id -u)/$LABEL" | grep -E "state|path" | head -3
