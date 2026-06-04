#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST=""
REMOTE_DIR="/opt/jianji"
MODE="runtime"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Jianji push update helper

Use this on a local machine that already has the latest Jianji source.
It syncs source files to a server over SSH, preserves server-only config/data,
and runs the server-side update script without asking the server to fetch GitHub.

Usage:
  bash scripts/push-update.sh --host user@example.com
  bash scripts/push-update.sh --host test --dir /opt/jianji --runtime

Options:
  --host HOST       SSH host, for example root@example.com or a local SSH alias.
  --dir PATH        Remote Jianji deployment directory. Default: /opt/jianji
  --runtime         Run scripts/update-runtime.sh on the server. Default.
  --compose         Run scripts/update.sh on the server.
  --dry-run         Show rsync changes without syncing or restarting.
  -h, --help        Show help.
USAGE
}

while [ "${1:-}" != "" ]; do
  case "$1" in
    --host)
      REMOTE_HOST="${2:?missing SSH host}"
      shift 2
      ;;
    --dir)
      REMOTE_DIR="${2:?missing remote directory}"
      shift 2
      ;;
    --runtime)
      MODE="runtime"
      shift
      ;;
    --compose)
      MODE="compose"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ "$REMOTE_HOST" = "" ]; then
  echo "--host is required." >&2
  usage
  exit 1
fi

if [ ! -f "package.json" ] || [ ! -f "docker-compose.yml" ] || [ ! -d "server" ] || [ ! -d "src" ]; then
  echo "Run this script from the Jianji repository root." >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "Missing required command: rsync" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "Missing required command: ssh" >&2
  exit 1
fi

LOCAL_BRANCH="$(git branch --show-current 2>/dev/null || printf 'main')"
LOCAL_COMMIT="$(git rev-parse HEAD 2>/dev/null || true)"
LOCAL_VERSION="$(git describe --tags --always --dirty 2>/dev/null || printf '0.1.0')"
LOCAL_REPO="$(git config --get remote.origin.url 2>/dev/null || printf 'https://github.com/staklab/jianji.git')"

RSYNC_FLAGS=(-az)
if [ "$DRY_RUN" -eq 1 ]; then
  RSYNC_FLAGS=(-azn --itemize-changes)
fi

EXCLUDES=(
  --exclude='.git/'
  --exclude='.env'
  --exclude='SETUP_URL.txt'
  --exclude='certs/'
  --exclude='.acme.sh/'
  --exclude='node_modules/'
  --exclude='server/node_modules/'
  --exclude='dist/'
  --exclude='server/dist/'
  --exclude='server/prisma/*.db'
  --exclude='server/prisma/*.db-*'
  --exclude='server/uploads/'
  --exclude='uploads/'
  --exclude='.update-backups/'
)

echo "== Jianji push update =="
echo "Remote: $REMOTE_HOST:$REMOTE_DIR"
echo "Mode: $MODE"
echo "Commit: ${LOCAL_COMMIT:-unknown}"
echo

rsync "${RSYNC_FLAGS[@]}" "${EXCLUDES[@]}" ./ "$REMOTE_HOST:$REMOTE_DIR/"

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "Dry run complete. No files were synced and no server command was executed."
  exit 0
fi

REMOTE_SCRIPT="scripts/update-runtime.sh"
if [ "$MODE" = "compose" ]; then
  REMOTE_SCRIPT="scripts/update.sh"
fi

ssh "$REMOTE_HOST" \
  "cd '$REMOTE_DIR' && JIANJI_SKIP_SOURCE_REFRESH=true JIANJI_CURRENT_COMMIT='$LOCAL_COMMIT' JIANJI_APP_VERSION='$LOCAL_VERSION' JIANJI_UPDATE_REPO='$LOCAL_REPO' JIANJI_UPDATE_BRANCH='$LOCAL_BRANCH' bash '$REMOTE_SCRIPT'"

echo
echo "Push update complete."
