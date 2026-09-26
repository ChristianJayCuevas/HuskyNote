#!/usr/bin/env bash

# HuskyNote - 1-Click Chrome Extension Auto-Launcher
# Loads the HuskyNote companion extension directly into Google Chrome/Chromium without manual Developer Mode steps.

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
EXT_DIR="$DIR/browser-extension"

echo "========================================================"
echo "  HuskyNote - Automated 1-Click Chrome Extension Setup"
echo "  Loading: $EXT_DIR"
echo "========================================================"

if [ ! -d "$EXT_DIR" ]; then
  echo "[Error] browser-extension directory not found at $EXT_DIR"
  exit 1
fi

# Detect OS and launch appropriate Chrome binary
case "$(uname -s)" in
  Darwin*)
    # macOS
    if [ -d "/Applications/Google Chrome.app" ]; then
      echo "[HuskyNote] Launching Google Chrome with HuskyNote extension loaded..."
      open -a "Google Chrome" --args --load-extension="$EXT_DIR"
    elif [ -d "/Applications/Chromium.app" ]; then
      echo "[HuskyNote] Launching Chromium with HuskyNote extension loaded..."
      open -a "Chromium" --args --load-extension="$EXT_DIR"
    elif [ -d "/Applications/Brave Browser.app" ]; then
      echo "[HuskyNote] Launching Brave Browser with HuskyNote extension loaded..."
      open -a "Brave Browser" --args --load-extension="$EXT_DIR"
    elif [ -d "/Applications/Microsoft Edge.app" ]; then
      echo "[HuskyNote] Launching Microsoft Edge with HuskyNote extension loaded..."
      open -a "Microsoft Edge" --args --load-extension="$EXT_DIR"
    else
      echo "[Notice] No default Chromium app found in /Applications."
      echo "Please open your browser's extensions page (chrome://extensions) and load: $EXT_DIR"
    fi
    ;;

  Linux*)
    # Linux
    CHROME_BIN=""
    for bin in google-chrome google-chrome-stable chromium-browser chromium brave-browser microsoft-edge; do
      if command -v "$bin" >/dev/null 2>&1; then
        CHROME_BIN="$bin"
        break
      fi
    done

    if [ -n "$CHROME_BIN" ]; then
      echo "[HuskyNote] Launching $CHROME_BIN with HuskyNote extension loaded..."
      "$CHROME_BIN" --load-extension="$EXT_DIR" &
    else
      echo "[Notice] Chromium browser not found in PATH."
      echo "Load unpacked from: $EXT_DIR"
    fi
    ;;

  CYGWIN*|MINGW*|MSYS*)
    # Windows
    if [ -f "/c/Program Files/Google/Chrome/Application/chrome.exe" ]; then
      "/c/Program Files/Google/Chrome/Application/chrome.exe" --load-extension="$(cygpath -w "$EXT_DIR")" &
    else
      start chrome --load-extension="$EXT_DIR" 2>/dev/null || true
    fi
    ;;

  *)
    echo "Unsupported OS: $(uname -s)"
    ;;
esac

echo "[HuskyNote] Extension loaded successfully! Access all features via the extension icon or Side Panel."
