#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${1:-${APP_DIR:-$HOME/vibro}}"
BRANCH="${BRANCH:-main}"

echo "[DEPLOY] app dir: ${APP_DIR}"
echo "[DEPLOY] branch: ${BRANCH}"

cd "${APP_DIR}"

git fetch --all --prune
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

docker compose up -d --build web

echo "[DEPLOY] active containers:"
docker compose ps
