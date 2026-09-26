#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "========================================================"
echo "  HuskyNote Chrome Extension - Automated 1-Click Launch"
echo "========================================================"
open -a "Google Chrome" --args --load-extension="$DIR" || open -a "Chromium" --args --load-extension="$DIR" || open -a "Brave Browser" --args --load-extension="$DIR"
echo "[HuskyNote] Browser launched with extension active!"
