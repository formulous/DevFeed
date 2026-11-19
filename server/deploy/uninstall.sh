#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "$DOMAIN/$LABEL"
  echo "[deploy] 해제: $LABEL"
fi
rm -f "$PLIST"
if launchctl print "$DOMAIN/$ROTATE_LABEL" >/dev/null 2>&1; then
  launchctl bootout "$DOMAIN/$ROTATE_LABEL"
  echo "[logrotate] 해제: $ROTATE_LABEL"
fi
rm -f "$ROTATE_PLIST"
