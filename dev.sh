#!/usr/bin/env bash
#
# PracOffice - run the backend and the frontend together.
#
#   ./dev.sh
#
# The React dev server (Vite, http://localhost:5173) proxies every /api request
# to the backend on http://localhost:3000 (see frontend/vite.config.mjs). If the
# backend is not running the proxy logs:
#
#   [vite] http proxy error: /api/auth/login
#   AggregateError [ECONNREFUSED]
#
# so both processes have to be started. This script starts the backend, waits
# for its health check, then starts the frontend. Ctrl-C stops both.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
API_HEALTH_URL="${API_HEALTH_URL:-http://localhost:3000/api/health}"

# Some setups expose Node.js only through a version manager or a bundled
# runtime, so fall back to a known-good location when `node` is not on PATH.
if ! command -v node >/dev/null 2>&1; then
  for bin_dir in \
    /opt/codex-desktop/resources/cua_node/bin \
    "$HOME/codex-desktop-linux/codex-app/resources/cua_node/bin" \
    "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"; do
    if [ -x "$bin_dir/node" ]; then
      PATH="$bin_dir:$PATH"
      if [ -d "$bin_dir/../lib/node_modules/corepack/shims" ]; then
        PATH="$bin_dir/../lib/node_modules/corepack/shims:$PATH"
      fi
      export PATH
      break
    fi

  done
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[dev] Node.js was not found on PATH. Install Node.js 18+ and retry." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[dev] npm was not found on PATH. Install Node.js 18+ (which ships npm) and retry." >&2
  exit 1
fi

echo "[dev] using node $(node --version)"

# The backend reads backend/.env (git-ignored). Create it from the template.
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "[dev] backend/.env is missing - copying backend/.env.example"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

# --- backend ----------------------------------------------------------------
echo "[dev] starting backend (http://localhost:3000/api)"
( cd "$BACKEND_DIR" && npm run dev ) &
BACKEND_PID=$!

cleanup() {
  echo
  echo "[dev] shutting down..."
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for the API to answer before Vite starts proxying to it.
for _ in $(seq 1 30); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[dev] the backend exited during startup - see the log above." >&2
    exit 1
  fi
  if curl -sf -m 2 "$API_HEALTH_URL" >/dev/null 2>&1; then
    echo "[dev] backend is healthy"
    break
  fi
  sleep 1
done

# --- frontend ---------------------------------------------------------------
echo "[dev] starting frontend (http://localhost:5173)"
cd "$FRONTEND_DIR"
npm run dev
