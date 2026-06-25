#!/usr/bin/env bash
# Build a self-signed, drag-and-drop DMG of the slate helper. No notarization.
# Users clear quarantine after install: xattr -dr com.apple.quarantine /Applications/SlateHelper.app
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="SlateHelper.xcodeproj"
SCHEME="SlateHelper"
APP="SlateHelper.app"
BUILD="build"
ARCHIVE="$BUILD/SlateHelper.xcarchive"
STAGE="$BUILD/dmg"
DMG="$BUILD/slate-helper.dmg"

# Generate the project if it is not present (it is gitignored; project.yml is the source of truth).
if [ ! -d "$PROJECT" ]; then
  command -v xcodegen >/dev/null 2>&1 || { echo "xcodegen not found: brew install xcodegen"; exit 1; }
  xcodegen generate
fi

rm -rf "$BUILD"
mkdir -p "$STAGE"

# Archive Release, then take the built .app straight from the archive (no provisioning profile needed).
xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
  -archivePath "$ARCHIVE" archive

cp -R "$ARCHIVE/Products/Applications/$APP" "$STAGE/$APP"

# Ad-hoc sign so the bundle is valid on any Mac (self-signed, not a Developer ID).
codesign --force --deep --sign - "$STAGE/$APP"

# Drag-and-drop layout: the app plus an Applications shortcut to drop it onto.
ln -s /Applications "$STAGE/Applications"

hdiutil create -volname "slate helper" -srcfolder "$STAGE" -ov -format UDZO "$DMG"

echo "built $DMG"
echo "release: gh release create vX.Y.Z $DMG <android.apk> --title 'slate vX.Y.Z'"
