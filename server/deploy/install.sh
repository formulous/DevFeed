#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

NODE_BIN="$(command -v node)"
[ -f "$SERVER_DIR/.env" ] || { echo "[deploy] $SERVER_DIR/.env 없음" >&2; exit 1; }
if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  echo "[deploy] 이미 등록됨. 재배포는 deploy.sh 사용" >&2
  exit 1
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[deploy] :$PORT 사용 중. 수동 실행 중인 서버를 먼저 종료해야 함" >&2
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2
  exit 1
fi

cd "$SERVER_DIR"
npm ci
npm run build
mkdir -p logs "$HOME/Library/LaunchAgents"
sed -e "s#__NODE__#$NODE_BIN#g" -e "s#__SERVER_DIR__#$SERVER_DIR#g" \
  deploy/org.formulous.dev-feed-server.plist.template > "$PLIST"
plutil -lint "$PLIST"
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "[deploy] 등록: $PLIST (node $NODE_BIN)"
wait_healthy
"$SERVER_DIR/deploy/install-logrotate.sh"
