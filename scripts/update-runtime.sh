#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${JIANJI_PROJECT_DIR:-$(pwd)}"
RUNTIME_BUILD_DIR="${JIANJI_RUNTIME_BUILD_DIR:-/opt/jianji-runtime-build}"
COMPOSE_FILE="${JIANJI_RUNTIME_COMPOSE_FILE:-docker-compose.runtime.yml}"
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

if [ ! -f "$COMPOSE_FILE" ] || [ ! -f ".env" ]; then
  echo "Runtime update requires $COMPOSE_FILE and .env in $PROJECT_DIR." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d%H%M%S)"
cp .env "$BACKUP_DIR/.env.$STAMP"
if [ -f SETUP_URL.txt ]; then
  cp SETUP_URL.txt "$BACKUP_DIR/SETUP_URL.txt.$STAMP"
fi

echo "== Jianji runtime-image update =="
echo "Project: $PROJECT_DIR"
echo "Runtime build dir: $RUNTIME_BUILD_DIR"
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
echo "Installing dependencies and building assets ..."
npm install --no-audit --no-fund
npm --prefix server install --no-audit --no-fund
npm --prefix server run prisma:generate
npm run build

TMP_DIR="${RUNTIME_BUILD_DIR}.next"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
cp server/package.json server/package-lock.json "$TMP_DIR"/
cp -a server/node_modules "$TMP_DIR"/node_modules
cp -a server/dist "$TMP_DIR"/dist
cp -a server/prisma "$TMP_DIR"/prisma
cp -a dist "$TMP_DIR"/public

if [ -f "$RUNTIME_BUILD_DIR/Dockerfile" ]; then
  cp "$RUNTIME_BUILD_DIR/Dockerfile" "$TMP_DIR"/Dockerfile
else
  cat > "$TMP_DIR"/Dockerfile <<'DOCKERFILE'
FROM node:20-bookworm-slim
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app
RUN set -eux; apt-get update -y; apt-get install -y --no-install-recommends openssl ca-certificates; rm -rf /var/lib/apt/lists/*
COPY node_modules ./node_modules
COPY dist ./dist
COPY prisma ./prisma
COPY package.json ./package.json
COPY public ./public
RUN mkdir -p /app/data /app/uploads
EXPOSE 4000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/index.js"]
DOCKERFILE
fi

echo
echo "Building runtime image ..."
(
  cd "$TMP_DIR"
  npm prune --omit=dev --no-audit --no-fund
  docker build -t jianji:runtime .
)

if [ -d "$RUNTIME_BUILD_DIR" ]; then
  mv "$RUNTIME_BUILD_DIR" "${RUNTIME_BUILD_DIR}.prev-$STAMP"
fi
mv "$TMP_DIR" "$RUNTIME_BUILD_DIR"

echo
echo "Restarting Jianji runtime container ..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" logs --tail=40 jianji

echo
echo "Runtime update complete."
