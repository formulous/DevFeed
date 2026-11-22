#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROLES=(pm client server dba)
KICKOFF=0
KICKOFF_MSG="roles/pm.md 지침대로 docs/spec/00-ideas.md에 아이디어 후보를 작성하고 나에게 선택을 요청해줘."
[[ "${1:-}" == "--kickoff" ]] && KICKOFF=1

command -v herdr >/dev/null || { echo "herdr 미설치: brew install herdr" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq 필요" >&2; exit 1; }

if [[ "${HERDR_ENV:-}" != 1 ]]; then
  echo "herdr pane 안에서 실행해야 함. 먼저 'herdr' 실행 후 그 안에서 다시 실행" >&2
  exit 1
fi

existing="$(herdr agent list | jq -r '[.. | objects | .name? // empty] | join(" ")')"
for r in "${ROLES[@]}"; do
  if [[ " $existing " == *" $r "* ]]; then
    echo "이미 실행 중인 agent 있음: $r (herdr agent list 확인)" >&2
    exit 1
  fi
done

pane_id() { jq -r '.result.pane.pane_id // .result.root_pane.pane_id // empty'; }

ws_json="$(herdr workspace create --cwd "$ROOT" --label formulous --no-focus)"
WS="$(jq -r '.result.workspace.workspace_id // .result.workspace.id' <<<"$ws_json")"
P_PM="$(pane_id <<<"$ws_json")"
P_SERVER="$(herdr pane split "$P_PM" --direction right --cwd "$ROOT" --no-focus | pane_id)"
P_CLIENT="$(herdr pane split "$P_PM" --direction down --cwd "$ROOT" --no-focus | pane_id)"
P_DBA="$(herdr pane split "$P_SERVER" --direction down --cwd "$ROOT" --no-focus | pane_id)"

pane_of() {
  case "$1" in
    pm) echo "$P_PM" ;;
    client) echo "$P_CLIENT" ;;
    server) echo "$P_SERVER" ;;
    dba) echo "$P_DBA" ;;
  esac
}

start_agent() {
  local name="$1" pane out code i
  pane="$(pane_of "$1")"
  herdr pane rename "$pane" "$name" >/dev/null
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if out="$(herdr agent start "$name" --kind claude --pane "$pane" --timeout 60000 -- \
        -n "$name" --append-system-prompt-file "$ROOT/roles/$name.md" 2>&1)"; then
      echo "started: $name ($pane)"
      return 0
    fi
    code="$(jq -r '.error.code // empty' <<<"$out" 2>/dev/null || true)"
    case "$code" in
      agent_not_ready|agent_name_taken)
        echo "확인 필요: $name ($pane) 화면의 신뢰/권한 대화상자에 응답해야 함"
        BLOCKED=1
        return 0 ;;
    esac
    sleep 1
  done
  echo "start 실패: $name ($pane): $out" >&2
  return 1
}

BLOCKED=0
for r in "${ROLES[@]}"; do start_agent "$r"; done

if [[ $KICKOFF == 1 ]]; then
  if [[ $BLOCKED == 1 ]]; then
    echo "kickoff 생략: 대화상자 응답 후 다음 명령 실행" >&2
    echo "  herdr agent prompt pm \"$KICKOFF_MSG\"" >&2
  else
    herdr agent prompt pm "$KICKOFF_MSG" >/dev/null
    echo "kickoff 전송: pm"
  fi
fi

herdr workspace focus "$WS" >/dev/null
echo "workspace: $WS"
