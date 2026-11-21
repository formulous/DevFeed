LABEL="org.formulous.dev-feed-server"
SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
ROTATE_LABEL="org.formulous.dev-feed-logrotate"
ROTATE_PLIST="$HOME/Library/LaunchAgents/$ROTATE_LABEL.plist"
DOMAIN="gui/$(id -u)"
PORT="${PORT:-3000}"

wait_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      echo "[deploy] health OK (:$PORT)"
      return 0
    fi
    sleep 1
  done
  echo "[deploy] health check failed. logs: $SERVER_DIR/logs/server.err.log" >&2
  return 1
}
