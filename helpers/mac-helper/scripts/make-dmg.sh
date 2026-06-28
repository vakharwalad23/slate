#!/usr/bin/env bash
# Build a self-signed, drag-and-drop DMG of the slate helper. No notarization.
# Other Macs do not trust the ad-hoc signature, so users clear quarantine after copying:
#   xattr -dr com.apple.quarantine /Applications/SlateHelper.app
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="SlateHelper.xcodeproj"
SCHEME="SlateHelper"
APP="SlateHelper.app"
BUILD="build"
ARCHIVE="$BUILD/SlateHelper.xcarchive"
STAGE="$BUILD/dmg"

command -v create-dmg >/dev/null 2>&1 || { echo "create-dmg not found: brew install create-dmg"; exit 1; }

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

# Ad-hoc sign so the bundle is structurally valid on any Mac (self-signed, not a Developer ID).
codesign --force --deep --sign - "$STAGE/$APP"

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$STAGE/$APP/Contents/Info.plist")"
DMG="$BUILD/slate-helper-$VERSION.dmg"
rm -f "$DMG"

# Drag-and-drop window: app on the left, Applications shortcut on the right, branded background.
create-dmg \
  --volname "slate helper" \
  --volicon "resources/slate.icns" \
  --background "resources/dmg-background.png" \
  --window-size 540 380 \
  --icon-size 128 \
  --icon "$APP" 130 180 \
  --app-drop-link 400 180 \
  --no-internet-enable \
  "$DMG" \
  "$STAGE/$APP"

echo "built $DMG"
echo "release: gh release create vX.Y.Z $DMG <android.apk> --title 'slate vX.Y.Z'"
