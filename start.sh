#!/usr/bin/env bash

# HuskyNote - Single-Click All-in-One Automated Launcher
# Strictly avoids emoji characters.

set -e

echo "--------------------------------------------------------"
echo "  HuskyNote - Local-First AI Workspace Launcher"
echo "  Capture it. Understand it. Keep it."
echo "--------------------------------------------------------"

# 1. Automate Ollama setup in background
if [ -f "scripts/setup-ollama.sh" ]; then
  bash scripts/setup-ollama.sh || echo "[HuskyNote] Proceeding with browser-only mode..."
fi

# 2. Check if node_modules exists, install if missing
if [ ! -d "node_modules" ]; then
  echo "[HuskyNote] Installing Node dependencies..."
  npm install
fi

# 3. Launch Vite development server
echo "[HuskyNote] Starting HuskyNote Web Application..."
npm run dev
