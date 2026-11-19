#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

if launchctl print "$DOMAIN/$ROTATE_LABEL" >/dev/null 2>&1; then
  echo "[logrotate] 이미 등록됨"
  exit 0
fi
mkdir -p "$SERVER_DIR/logs" "$HOME/Library/LaunchAgents"
sed -e "s#__SERVER_DIR__#$SERVER_DIR#g" \
  "$SERVER_DIR/deploy/org.formulous.portfolio-logrotate.plist.template" > "$ROTATE_PLIST"
plutil -lint "$ROTATE_PLIST"
launchctl bootstrap "$DOMAIN" "$ROTATE_PLIST"
echo "[logrotate] 등록: $ROTATE_PLIST (매시간 확인, 10MB 초과 또는 24시간 경과 시 회전, 7세대 보관)"
