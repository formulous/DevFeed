#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1 || { echo "[deploy] 등록 안 됨. install.sh 먼저 실행" >&2; exit 1; }
cd "$SERVER_DIR"
npm ci
npm run build
launchctl kickstart -k "$DOMAIN/$LABEL"
echo "[deploy] 재시작함"
wait_healthy
