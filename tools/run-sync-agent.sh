#!/usr/bin/env bash
# Cron entry point: loads sync-agent.env next to this script and runs one pass of the agent.
#   ./run-sync-agent.sh --dry      try it without sending anything
#   ./run-sync-agent.sh            push game -> portal
#   ./run-sync-agent.sh --pull     push, and send portal edits to the game
# crontab:  */10 * * * * /opt/plot-sync/tools/run-sync-agent.sh --pull >> /opt/plot-sync/sync.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
[ -f sync-agent.env ] || { echo "sync-agent.env missing (copy sync-agent.env.example)"; exit 2; }
set -a; . ./sync-agent.env; set +a
exec node sync-agent.mjs "$@"
