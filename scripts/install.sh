#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${JIANJI_REPO_URL:-https://github.com/staklab/jianji.git}"
INSTALL_DIR="${JIANJI_INSTALL_DIR:-jianji}"
BRANCH="${JIANJI_BRANCH:-main}"
FORCE_ENV=0
YES=0
APP_URL_ARG="${JIANJI_APP_URL:-}"
COOKIE_SECURE_ARG="${JIANJI_COOKIE_SECURE:-}"
SERVICE_NAME="${JIANJI_SERVICE_NAME:-jianji}"

usage() {
  cat <<'USAGE'
Jianji one-click installer

Usage:
  bash scripts/install.sh
  curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash

Options:
  --repo URL        Git repository URL. Default: https://github.com/staklab/jianji.git
  --dir PATH        Install directory when running from curl. Default: ./jianji
  --branch NAME     Git branch to clone. Default: main
  --app-url URL     Public URL, for example https://jianji.example.com
  --secure-cookie   Force COOKIE_SECURE=true
  --no-secure-cookie Force COOKIE_SECURE=false
  --force-env       Overwrite existing .env without asking.
  -y, --yes         Non-interactive mode. Keeps existing .env unless --force-env is also set.
  -h, --help        Show help.
USAGE
}

while [ "${1:-}" != "" ]; do
  case "$1" in
    --repo)
      REPO_URL="${2:?missing repo url}"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="${2:?missing install dir}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:?missing branch name}"
      shift 2
      ;;
    --app-url)
      APP_URL_ARG="${2:?missing public url}"
      shift 2
      ;;
    --secure-cookie)
      COOKIE_SECURE_ARG="true"
      shift
      ;;
    --no-secure-cookie)
      COOKIE_SECURE_ARG="false"
      shift
      ;;
    --force-env)
      FORCE_ENV=1
      shift
      ;;
    -y|--yes)
      YES=1
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

has_project_files() {
  [ -f "docker-compose.yml" ] && [ -f "package.json" ] && [ -d "server" ] && [ -d "src" ]
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

compose() {
  docker compose "$@"
}

write_setup_url_file() {
  local app_url="${1:-}"
  local setup_token="${2:-}"
  if [ "$app_url" = "" ] || [ "$setup_token" = "" ]; then
    return
  fi
  local app_url_no_slash="${app_url%/}"
  umask 077
  printf '%s\n' "${app_url_no_slash}/setup?token=${setup_token}" > SETUP_URL.txt
}

env_value() {
  local key="$1"
  if [ ! -f ".env" ]; then
    return
  fi
  grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2-
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  if [ -f ".env" ]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { done = 0 }
      $0 ~ "^" key "=" { print key "=" value; done = 1; next }
      { print }
      END { if (!done) print key "=" value }
    ' .env > "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" > "$tmp"
  fi
  cat "$tmp" > .env
  rm -f "$tmp"
}

git_current_commit() {
  git rev-parse HEAD 2>/dev/null || true
}

git_app_version() {
  git describe --tags --always --dirty 2>/dev/null || printf '%s' "${JIANJI_APP_VERSION:-0.1.0}"
}

git_current_branch() {
  git branch --show-current 2>/dev/null || printf '%s' "$BRANCH"
}

git_remote_url() {
  git config --get remote.origin.url 2>/dev/null || printf '%s' "$REPO_URL"
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
  local branch
  local repo
  local commit
  local version
  local check_url
  branch="$(git_current_branch)"
  repo="$(git_remote_url)"
  commit="$(git_current_commit)"
  version="$(git_app_version)"
  check_url="${JIANJI_UPDATE_CHECK_URL:-$(github_commit_api_url "$repo" "$branch")}"
  if [ "$check_url" = "" ]; then
    check_url="https://api.github.com/repos/staklab/jianji/commits/main"
  fi
  set_env_value APP_VERSION "${JIANJI_APP_VERSION:-$version}"
  set_env_value JIANJI_CURRENT_COMMIT "$commit"
  set_env_value JIANJI_UPDATE_REPO "$repo"
  set_env_value JIANJI_UPDATE_BRANCH "$branch"
  set_env_value JIANJI_UPDATE_CHECK_URL "$check_url"
  if ! grep -q '^JIANJI_LATEST_VERSION=' .env; then
    set_env_value JIANJI_LATEST_VERSION "${JIANJI_LATEST_VERSION:-}"
  fi
  if ! grep -q '^JIANJI_UPDATE_COMMAND=' .env; then
    set_env_value JIANJI_UPDATE_COMMAND "${JIANJI_UPDATE_COMMAND:-}"
  fi
  if ! grep -q '^JIANJI_UPDATE_ARCHIVE_URL=' .env; then
    set_env_value JIANJI_UPDATE_ARCHIVE_URL "${JIANJI_UPDATE_ARCHIVE_URL:-}"
  fi
}

wait_for_service() {
  local id=""
  local status=""
  local attempt=0
  echo "Waiting for $SERVICE_NAME to become healthy ..."
  for attempt in {1..80}; do
    id="$(compose ps -q "$SERVICE_NAME" 2>/dev/null || true)"
    if [ "$id" != "" ]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
      if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
        echo "$SERVICE_NAME status: $status"
        return 0
      fi
    fi
    sleep 2
  done
  echo "$SERVICE_NAME did not become healthy in time." >&2
  compose ps >&2 || true
  compose logs --tail=80 "$SERVICE_NAME" >&2 || true
  return 1
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64
  fi
}

prompt() {
  local label="$1"
  local default_value="${2:-}"
  local value
  if [ "$default_value" != "" ]; then
    read -r -p "$label [$default_value]: " value
    printf '%s' "${value:-$default_value}"
  else
    read -r -p "$label: " value
    printf '%s' "$value"
  fi
}

prompt_secret() {
  local label="$1"
  local value
  while true; do
    read -r -s -p "$label: " value
    echo
    if [ "$value" != "" ]; then
      printf '%s' "$value"
      return
    fi
    echo "This value is required."
  done
}

bool_prompt() {
  local label="$1"
  local default_value="$2"
  local value
  read -r -p "$label [$default_value]: " value
  value="${value:-$default_value}"
  case "$value" in
    true|TRUE|yes|YES|y|Y|1) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

if ! has_project_files; then
  need_cmd git
  if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Using existing repository: $INSTALL_DIR"
    cd "$INSTALL_DIR"
    git pull --ff-only
  else
    echo "Cloning Jianji from $REPO_URL ..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
fi

need_cmd docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Please install Docker Engine with the compose plugin." >&2
  exit 1
fi

echo
echo "== Jianji production configuration =="
echo "Only runtime secrets and the private setup token will be written to .env."
echo "Admin account and SMTP settings are configured in the first-run web setup page."
echo "Do not commit .env to Git."
echo

if [ -f ".env" ] && [ "$FORCE_ENV" -ne 1 ]; then
  overwrite="N"
  if [ "$YES" -ne 1 ]; then
    read -r -p ".env already exists. Overwrite it? [y/N]: " overwrite
  fi
  case "$overwrite" in
    y|Y|yes|YES) ;;
    *)
      echo "Keeping existing .env"
      write_setup_url_file "$(env_value APP_URL)" "$(env_value SETUP_TOKEN)"
      write_deployment_metadata
      compose up -d --build
      wait_for_service
      echo "Jianji is running. Check: docker compose ps"
      if [ -f SETUP_URL.txt ]; then
        echo "Setup URL file: $(pwd)/SETUP_URL.txt"
        echo "View it with: cat $(pwd)/SETUP_URL.txt"
      fi
      exit 0
      ;;
  esac
fi

if [ "$APP_URL_ARG" != "" ]; then
  APP_URL="$APP_URL_ARG"
elif [ "$YES" -eq 1 ]; then
  APP_URL="http://localhost:4000"
else
  APP_URL="$(prompt 'Public URL, for example https://jianji.example.com' 'http://localhost:4000')"
fi
COOKIE_SECURE_DEFAULT="false"
case "$APP_URL" in
  https://*) COOKIE_SECURE_DEFAULT="true" ;;
esac
if [ "$COOKIE_SECURE_ARG" != "" ]; then
  COOKIE_SECURE="$COOKIE_SECURE_ARG"
elif [ "$YES" -eq 1 ]; then
  COOKIE_SECURE="$COOKIE_SECURE_DEFAULT"
else
  COOKIE_SECURE="$(bool_prompt 'Use secure cookies? Set true for HTTPS' "$COOKIE_SECURE_DEFAULT")"
fi
JWT_SECRET="$(generate_secret)"
SETUP_TOKEN="$(generate_secret)"
APP_URL_NO_SLASH="${APP_URL%/}"
SETUP_URL="${APP_URL_NO_SLASH}/setup?token=${SETUP_TOKEN}"

umask 077
cat > .env <<EOF
APP_URL=${APP_URL}
DATABASE_URL=file:/app/data/dev.db
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
COOKIE_NAME=jianji_session
COOKIE_SECURE=${COOKIE_SECURE}
SETUP_TOKEN=${SETUP_TOKEN}
MAIL_ENABLED=false
ALLOW_PUBLIC_REGISTER=true
EOF
write_deployment_metadata
write_setup_url_file "$APP_URL" "$SETUP_TOKEN"

echo
echo "Starting Jianji with Docker Compose ..."
compose up -d --build
wait_for_service

echo
echo "Jianji is deployed."
echo "URL: ${APP_URL}"
echo
echo "Open this private setup link in your browser to create the administrator account and SMTP configuration:"
echo "  ${SETUP_URL}"
echo
echo "Keep this link private. After setup is completed, the setup form is closed automatically."
echo "The same link is saved on this server as:"
echo "  $(pwd)/SETUP_URL.txt"
echo "You can view it later with:"
echo "  cat $(pwd)/SETUP_URL.txt"
echo
echo "Useful commands:"
echo "  docker compose ps"
echo "  docker compose logs -f jianji"
echo "  bash scripts/update.sh"
