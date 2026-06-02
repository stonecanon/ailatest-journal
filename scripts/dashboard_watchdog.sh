#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${1:-4177}"
LOG_FILE=".dashboard-server.log"
ERR_FILE=".dashboard-server.err.log"
PATH="/Users/zhizhi/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PATH

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  exit 0
fi

if command -v screen >/dev/null 2>&1; then
  screen -S ailatest-dashboard -X quit >/dev/null 2>&1 || true
  screen -dmS ailatest-dashboard /bin/zsh -lc "cd '$PWD' && PATH='$PATH' exec node scripts/serve_dashboard.mjs '$PORT' >> '$PWD/$LOG_FILE' 2>> '$PWD/$ERR_FILE'"
  exit 0
fi

nohup node scripts/serve_dashboard.mjs "$PORT" >> "$LOG_FILE" 2>> "$ERR_FILE" &
