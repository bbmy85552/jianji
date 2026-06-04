#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${JIANJI_PROJECT_DIR:-$(pwd)}"
BACKUP_DIR="${JIANJI_UPDATE_BACKUP_DIR:-$PROJECT_DIR/.update-backups}"

cd "$PROJECT_DIR"

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    $0 ~ "^" key "=" { print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }
  ' .env > "$tmp"
  cat "$tmp" > .env
  rm -f "$tmp"
}

github_commit_api_url() {
  local repo="${1%.git}"
  local branch="$2"
  local path=""
  case "$repo" in
    https://github.com/*) path="${repo#https://github.com/}" ;;
    git@github.com:*) path="${repo#git@github.com:}" ;;
  esac
  if [ "$path" != "" ]; then
    printf 'https://api.github.com/repos/%s/commits/%s' "$path" "$branch"
  fi
}

write_deployment_metadata() {
  local branch=""
  local repo=""
  local commit=""
  local version=""
  local check_url=""
  branch="$(git branch --show-current 2>/dev/null || true)"
  repo="$(git config --get remote.origin.url 2>/dev/null || true)"
  commit="$(git rev-parse HEAD 2>/dev/null || true)"
  version="$(git describe --tags --always --dirty 2>/dev/null || printf '0.1.0')"
  check_url="${JIANJI_UPDATE_CHECK_URL:-$(github_commit_api_url "$repo" "${branch:-main}")}"
  if [ "$check_url" = "" ]; then
    check_url="https://api.github.com/repos/staklab/jianji/commits/main"
  fi
  set_env_value APP_VERSION "$version"
  set_env_value JIANJI_CURRENT_COMMIT "$commit"
  set_env_value JIANJI_UPDATE_REPO "${repo:-https://github.com/staklab/jianji.git}"
  set_env_value JIANJI_UPDATE_BRANCH "${branch:-main}"
  set_env_value JIANJI_UPDATE_CHECK_URL "$check_url"
  if ! grep -q '^JIANJI_LATEST_VERSION=' .env; then
    set_env_value JIANJI_LATEST_VERSION "${JIANJI_LATEST_VERSION:-}"
  fi
  if ! grep -q '^JIANJI_UPDATE_COMMAND=' .env; then
    set_env_value JIANJI_UPDATE_COMMAND "${JIANJI_UPDATE_COMMAND:-}"
  fi
}

if [ ! -f "docker-compose.yml" ] || [ ! -f ".env" ]; then
  echo "Please run this script from the Jianji deployment directory, or set JIANJI_PROJECT_DIR." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d%H%M%S)"
cp .env "$BACKUP_DIR/.env.$STAMP"

if [ -f SETUP_URL.txt ]; then
  cp SETUP_URL.txt "$BACKUP_DIR/SETUP_URL.txt.$STAMP"
fi

echo "== Jianji safe update =="
echo "Project: $PROJECT_DIR"
echo "Config backup: $BACKUP_DIR/.env.$STAMP"
echo "Docker volumes are preserved. This script does not delete databases or uploads."
echo

if [ -d ".git" ]; then
  echo "Pulling latest source ..."
  git fetch --all --prune
  git pull --ff-only
else
  echo "No .git directory found; using the current source tree."
fi

write_deployment_metadata

echo
echo "Rebuilding and restarting Jianji ..."
docker compose up -d --build

echo
echo "Running service check ..."
docker compose ps
docker compose logs --tail=40 jianji

echo
echo "Update complete."
echo "If this instance is not initialized yet, view the setup link with:"
echo "  cat $PROJECT_DIR/SETUP_URL.txt"
