#!/usr/bin/env bash
# Packages the built web app (dist/) for Linux as an AppImage and a portable
# .tar.gz in build/linux/. Run `npm run build` first. Needs curl to fetch
# appimagetool the first time.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f dist/index.html ] || { echo "dist/ is missing; run npm run build first" >&2; exit 1; }

VERSION="$(node -p "require('./package.json').version")"
OUT="build/linux"
APPDIR="$OUT/HuskyNote.AppDir"
rm -rf "$OUT"
mkdir -p "$APPDIR/usr/share/huskynote" "$APPDIR/usr/share/icons/hicolor/256x256/apps" "$APPDIR/usr/share/applications"

# The web app without the downloadable installers, plus the static server
rsync -a --exclude 'downloads' dist/ "$APPDIR/usr/share/huskynote/web/"
cp desktop/serve.py "$APPDIR/usr/share/huskynote/serve.py"

cp desktop/linux/AppRun "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"
cp desktop/linux/huskynote.desktop "$APPDIR/huskynote.desktop"
cp desktop/linux/huskynote.desktop "$APPDIR/usr/share/applications/huskynote.desktop"
cp desktop/linux/huskynote.png "$APPDIR/huskynote.png"
cp desktop/linux/huskynote.png "$APPDIR/usr/share/icons/hicolor/256x256/apps/huskynote.png"
ln -sf huskynote.png "$APPDIR/.DirIcon"

# Portable folder: extract anywhere and run ./HuskyNote
TAR_DIR="$OUT/HuskyNote"
cp -a "$APPDIR" "$TAR_DIR"
ln -sf AppRun "$TAR_DIR/HuskyNote"
tar -C "$OUT" -czf "$OUT/HuskyNote-Linux-x64.tar.gz" HuskyNote
rm -rf "$TAR_DIR"

# AppImage (a single executable file)
TOOL="$OUT/appimagetool"
curl -fsSL -o "$TOOL" https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x "$TOOL"
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 VERSION="$VERSION" "$TOOL" --no-appstream "$APPDIR" "$OUT/HuskyNote-Linux-x86_64.AppImage"
rm -f "$TOOL"

ls -lh "$OUT"/*.AppImage "$OUT"/*.tar.gz
