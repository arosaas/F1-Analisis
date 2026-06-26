#!/usr/bin/env bash
# Lanza backend (FastAPI + FastF1) y frontend (Vite) en paralelo.
set -euo pipefail
cd "$(dirname "$0")"

# 1) Backend
if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --upgrade pip
  backend/.venv/bin/pip install -r backend/requirements.txt
fi
backend/.venv/bin/python -m uvicorn backend.app:app --port 8000 --reload &
BACK_PID=$!
trap "kill $BACK_PID 2>/dev/null || true" EXIT

# 2) Frontend
if command -v bun >/dev/null 2>&1; then
  [ -d node_modules ] || bun install
  bun run dev
else
  [ -d node_modules ] || npm install
  npm run dev
fi
