#!/usr/bin/env bash

# HuskyNote - 1-Click macOS Launcher & Gatekeeper Unquarantine Helper
# Resolves macOS "App is damaged and can't be opened" error on open-source apps.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================================"
echo "  HuskyNote macOS Launcher - Personal AI Secretary"
echo "========================================================"

TARGET_APP=""
if [ -d "/Applications/HuskyNote.app" ]; then
  TARGET_APP="/Applications/HuskyNote.app"
elif [ -d "$DIR/HuskyNote.app" ]; then
  TARGET_APP="$DIR/HuskyNote.app"
elif [ -d "$DIR/../HuskyNote.app" ]; then
  TARGET_APP="$DIR/../HuskyNote.app"
fi

if [ -n "$TARGET_APP" ]; then
  echo "[HuskyNote] Removing macOS Gatekeeper quarantine from $TARGET_APP..."
  xattr -cr "$TARGET_APP" 2>/dev/null || sudo xattr -cr "$TARGET_APP" 2>/dev/null || true
  echo "[HuskyNote] Launching HuskyNote..."
  open "$TARGET_APP"
else
  echo "[Notice] HuskyNote.app not found in Applications or current directory."
  echo "Please drag HuskyNote.app into your /Applications folder, then re-run this helper."
fi
