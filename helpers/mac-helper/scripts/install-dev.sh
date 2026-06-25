#!/usr/bin/env bash
# Install the helper to ~/Applications (stable path, no admin) so the Accessibility grant works.
# Signs with the "slate-self-signed" identity if present (grant persists across rebuilds), else ad-hoc.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_SRC="${1:-/tmp/slate-rel/Build/Products/Release/SlateHelper.app}"
DEST="$HOME/Applications/SlateHelper.app"

if security find-identity -p codesigning | grep -q "slate-self-signed"; then
  SIGN_ID="slate-self-signed"
else
  SIGN_ID="-"
fi

mkdir -p "$HOME/Applications"
pkill -f "SlateHelper.app" 2>/dev/null || true
sleep 1
rm -rf "$DEST"
cp -R "$APP_SRC" "$DEST"
codesign --force --deep --sign "$SIGN_ID" "$DEST"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

open "$DEST"
echo "installed + launched $DEST (signed: $SIGN_ID)"
