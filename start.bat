@echo off
REM Lanza backend (FastAPI + FastF1) y frontend (Vite).
cd /d "%~dp0"

if not exist backend\.venv (
  python -m venv backend\.venv
  backend\.venv\Scripts\pip install --upgrade pip
  backend\.venv\Scripts\pip install -r backend\requirements.txt
)

start "F1 backend" backend\.venv\Scripts\python -m uvicorn backend.app:app --port 8000 --reload

where bun >nul 2>nul
if %ERRORLEVEL%==0 (
  if not exist node_modules bun install
  bun run dev
) else (
  if not exist node_modules npm install
  npm run dev
)
