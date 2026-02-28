#!/usr/bin/env bash
# Simple dev run script for SmartMeds
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Creating virtualenv .venv (if missing)"
python3 -m venv .venv || true
source .venv/bin/activate

echo "Installing requirements"
pip install --upgrade pip
pip install -r requirements.txt

# Ensure spaCy model is available
python -m spacy download en_core_web_sm || true

echo "Starting backend (Flask) on http://127.0.0.1:5000"
python3 backend/app.py &
BACKEND_PID=$!

echo "Starting static server for frontend on http://127.0.0.1:8000"
python3 -m http.server 8000 --directory frontend &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID  Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID; exit 0" INT TERM

wait
