#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${1:-4177}"
PID_FILE=".dashboard-server.pid"
LOG_FILE=".dashboard-server.log"
ERR_FILE=".dashboard-server.err.log"
PLIST_FILE="$PWD/.dashboard-server.plist"
LABEL="org.ailatest.journal-dashboard"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Dashboard server already running at http://127.0.0.1:$PORT/dashboard/"
  exit 0
fi

if command -v launchctl >/dev/null 2>&1; then
  UID_VALUE="$(id -u)"
  START_CMD="cd '$PWD' && PATH=/Users/zhizhi/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin exec node scripts/serve_dashboard.mjs '$PORT'"
  cat > "$PLIST_FILE" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>$START_CMD</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PWD</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$PWD/$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$PWD/$ERR_FILE</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLIST

  launchctl bootout "gui/$UID_VALUE" "$PLIST_FILE" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$UID_VALUE" "$PLIST_FILE"
  launchctl kickstart -k "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true

  sleep 2

  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Dashboard server started at http://127.0.0.1:$PORT/dashboard/"
    echo "Managed by launchctl label: $LABEL"
    echo "Log: $LOG_FILE"
    exit 0
  fi

  echo "launchctl service failed to start, falling back to screen."
  launchctl bootout "gui/$UID_VALUE" "$PLIST_FILE" >/dev/null 2>&1 || true
fi

if command -v screen >/dev/null 2>&1; then
  screen -S ailatest-dashboard -X quit >/dev/null 2>&1 || true
  screen -dmS ailatest-dashboard /bin/zsh -lc "cd '$PWD' && PATH=/Users/zhizhi/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin exec node scripts/serve_dashboard.mjs '$PORT' >> '$PWD/$LOG_FILE' 2>> '$PWD/$ERR_FILE'"
  sleep 2
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Dashboard server started at http://127.0.0.1:$PORT/dashboard/"
    echo "Managed by screen session: ailatest-dashboard"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  echo "screen service failed to start. Logs:"
  tail -50 "$LOG_FILE" "$ERR_FILE" 2>/dev/null || true
  exit 1
fi

nohup node scripts/serve_dashboard.mjs "$PORT" > "$LOG_FILE" 2>&1 &
PID="$!"
echo "$PID" > "$PID_FILE"

sleep 1

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Dashboard server started at http://127.0.0.1:$PORT/dashboard/"
  echo "Log: $LOG_FILE"
else
  echo "Dashboard server failed to start. Log:"
  tail -50 "$LOG_FILE" || true
  exit 1
fi
