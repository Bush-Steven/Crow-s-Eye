#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="$ROOT_DIR/crows-eye.zip"
APP_DIR="$ROOT_DIR/crows-eye"
VENV_DIR="$ROOT_DIR/.venv"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Missing archive: $ARCHIVE"
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "Extracting project archive..."
  unzip -o "$ARCHIVE" -d "$ROOT_DIR" >/dev/null
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "Extraction failed. Expected app directory at $APP_DIR"
  exit 1
fi

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

cd "$APP_DIR"

if [[ -f requirements.txt ]]; then
  echo "Installing Python dependencies..."
  python -m pip install --upgrade pip >/dev/null
  python -m pip install -r requirements.txt
fi

if [[ -f docker-compose.yml ]]; then
  echo "Starting Crow-s-Eye with Docker Compose..."
  docker compose up --build
else
  echo "Starting Crow-s-Eye server..."
  if [[ -f server/main.py ]]; then
    python server/main.py
  elif [[ -f server/app.py ]]; then
    python server/app.py
  else
    echo "No application entry point found in $APP_DIR/server"
    exit 1
  fi
fi
